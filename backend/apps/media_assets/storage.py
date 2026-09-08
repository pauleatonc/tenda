"""R2-compatible private object storage boundary."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.parse import quote

import boto3
from django.conf import settings

from apps.media_assets.keys import r2_object_key
from tenda.errors import DomainError

IN_PROCESS_STORAGE_PROVIDERS = frozenset({"fake", "local"})


def uses_in_process_upload() -> bool:
    return str(getattr(settings, "OBJECT_STORAGE_PROVIDER", "fake")) in IN_PROCESS_STORAGE_PROVIDERS


@dataclass(frozen=True, slots=True)
class PresignedUpload:
    url: str
    headers: dict[str, str]
    expires_in_seconds: int


@dataclass(frozen=True, slots=True)
class StoredObject:
    size: int
    content_type: str
    checksum_sha256: str = ""


class ObjectStorage(Protocol):
    def presign_upload(
        self,
        *,
        key: str,
        content_type: str,
        size: int,
        expires_in_seconds: int,
    ) -> PresignedUpload: ...

    def presign_download(self, *, key: str, expires_in_seconds: int) -> str: ...

    def head(self, *, key: str) -> StoredObject: ...

    def read_bytes(self, *, key: str) -> bytes: ...

    def write_bytes(self, *, key: str, content: bytes, content_type: str) -> StoredObject: ...

    def delete(self, *, key: str) -> None: ...


class FakeObjectStorage:
    def __init__(self) -> None:
        self.objects: dict[str, StoredObject] = {}
        self.contents: dict[str, bytes] = {}

    def presign_upload(
        self,
        *,
        key: str,
        content_type: str,
        size: int,
        expires_in_seconds: int,
    ) -> PresignedUpload:
        self.objects[key] = StoredObject(size=size, content_type=content_type)
        return PresignedUpload(
            url=f"https://r2.invalid/upload/{quote(key)}",
            headers={"Content-Type": content_type},
            expires_in_seconds=expires_in_seconds,
        )

    def presign_download(self, *, key: str, expires_in_seconds: int) -> str:
        if key not in self.objects:
            raise DomainError("FILE_NOT_FOUND", "No encontramos el archivo.", status=404)
        return f"https://r2.invalid/download/{quote(key)}?expires={expires_in_seconds}"

    def head(self, *, key: str) -> StoredObject:
        try:
            return self.objects[key]
        except KeyError as exc:
            raise DomainError(
                "UPLOAD_NOT_FOUND",
                "No encontramos el archivo cargado.",
                status=404,
            ) from exc

    def read_bytes(self, *, key: str) -> bytes:
        if key not in self.objects:
            raise DomainError("FILE_NOT_FOUND", "No encontramos el archivo.", status=404)
        return self.contents.get(key, b"")

    def write_bytes(self, *, key: str, content: bytes, content_type: str) -> StoredObject:
        stored = StoredObject(
            size=len(content),
            content_type=content_type,
            checksum_sha256=hashlib.sha256(content).hexdigest(),
        )
        self.objects[key] = stored
        self.contents[key] = content
        return stored

    def delete(self, *, key: str) -> None:
        self.objects.pop(key, None)
        self.contents.pop(key, None)

    def clear(self) -> None:
        self.objects.clear()
        self.contents.clear()


class LocalFileObjectStorage:
    """Persist uploads under Django MEDIA_ROOT so local checkout is inspectable."""

    def __init__(self, root: Path | None = None) -> None:
        configured = getattr(settings, "MEDIA_ROOT", None)
        self.root = Path(root or configured or "media")

    def _path(self, key: str) -> Path:
        relative = Path(key)
        if relative.is_absolute() or ".." in relative.parts:
            raise DomainError("INVALID_OBJECT_KEY", "La ruta del archivo no es válida.")
        return self.root.joinpath(*relative.parts)

    def _meta_path(self, path: Path) -> Path:
        return path.with_name(f"{path.name}.meta.json")

    def presign_upload(
        self,
        *,
        key: str,
        content_type: str,
        size: int,
        expires_in_seconds: int,
    ) -> PresignedUpload:
        del size
        return PresignedUpload(
            url=f"https://r2.invalid/upload/{quote(key)}",
            headers={"Content-Type": content_type},
            expires_in_seconds=expires_in_seconds,
        )

    def presign_download(self, *, key: str, expires_in_seconds: int) -> str:
        if not self._path(key).is_file():
            raise DomainError("FILE_NOT_FOUND", "No encontramos el archivo.", status=404)
        return f"https://r2.invalid/download/{quote(key)}?expires={expires_in_seconds}"

    def head(self, *, key: str) -> StoredObject:
        path = self._path(key)
        if not path.is_file():
            raise DomainError(
                "UPLOAD_NOT_FOUND",
                "No encontramos el archivo cargado.",
                status=404,
            )
        meta = self._read_meta(path)
        return StoredObject(
            size=path.stat().st_size,
            content_type=str(meta.get("content_type", "")),
            checksum_sha256=str(meta.get("sha256", "")),
        )

    def read_bytes(self, *, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise DomainError("FILE_NOT_FOUND", "No encontramos el archivo.", status=404)
        return path.read_bytes()

    def write_bytes(self, *, key: str, content: bytes, content_type: str) -> StoredObject:
        path = self._path(key)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            checksum = hashlib.sha256(content).hexdigest()
            path.write_bytes(content)
            self._meta_path(path).write_text(
                json.dumps({"content_type": content_type, "sha256": checksum}),
                encoding="utf-8",
            )
        except PermissionError as exc:
            raise DomainError(
                "STORAGE_NOT_WRITABLE",
                "No pudimos guardar el archivo en el disco local.",
                status=500,
            ) from exc
        return StoredObject(
            size=len(content),
            content_type=content_type,
            checksum_sha256=checksum,
        )

    def delete(self, *, key: str) -> None:
        path = self._path(key)
        path.unlink(missing_ok=True)
        self._meta_path(path).unlink(missing_ok=True)

    def _read_meta(self, path: Path) -> dict[str, str]:
        meta_path = self._meta_path(path)
        if not meta_path.is_file():
            return {}
        try:
            payload = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        if not isinstance(payload, dict):
            return {}
        return {str(name): str(value) for name, value in payload.items()}


class R2ObjectStorage:
    def __init__(self) -> None:
        endpoint = str(getattr(settings, "R2_ENDPOINT_URL", ""))
        access_key = str(getattr(settings, "R2_ACCESS_KEY_ID", ""))
        secret_key = str(getattr(settings, "R2_SECRET_ACCESS_KEY", ""))
        bucket = str(getattr(settings, "R2_BUCKET_NAME", ""))
        if not all((endpoint, access_key, secret_key, bucket)):
            raise DomainError(
                "STORAGE_NOT_CONFIGURED",
                "El almacenamiento privado no está configurado.",
                status=503,
                retryable=True,
            )
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
        )

    def _key(self, key: str) -> str:
        return r2_object_key(key)

    def presign_upload(
        self,
        *,
        key: str,
        content_type: str,
        size: int,
        expires_in_seconds: int,
    ) -> PresignedUpload:
        del size
        url = self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": self._key(key),
                "ContentType": content_type,
            },
            ExpiresIn=expires_in_seconds,
        )
        return PresignedUpload(
            url=str(url),
            headers={"Content-Type": content_type},
            expires_in_seconds=expires_in_seconds,
        )

    def presign_download(self, *, key: str, expires_in_seconds: int) -> str:
        return str(
            self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": self._key(key)},
                ExpiresIn=expires_in_seconds,
            )
        )

    def head(self, *, key: str) -> StoredObject:
        try:
            result = self.client.head_object(Bucket=self.bucket, Key=self._key(key))
        except Exception as exc:
            raise DomainError(
                "UPLOAD_NOT_FOUND",
                "No encontramos el archivo cargado.",
                status=404,
            ) from exc
        metadata = result.get("Metadata", {})
        return StoredObject(
            size=int(result["ContentLength"]),
            content_type=str(result.get("ContentType", "")),
            checksum_sha256=str(metadata.get("sha256", "")),
        )

    def read_bytes(self, *, key: str) -> bytes:
        try:
            result = self.client.get_object(Bucket=self.bucket, Key=self._key(key))
            return bytes(result["Body"].read())
        except Exception as exc:
            raise DomainError(
                "FILE_NOT_FOUND",
                "No encontramos el archivo.",
                status=404,
            ) from exc

    def write_bytes(self, *, key: str, content: bytes, content_type: str) -> StoredObject:
        checksum = hashlib.sha256(content).hexdigest()
        self.client.put_object(
            Bucket=self.bucket,
            Key=self._key(key),
            Body=content,
            ContentType=content_type,
            Metadata={"sha256": checksum},
        )
        return StoredObject(
            size=len(content),
            content_type=content_type,
            checksum_sha256=checksum,
        )

    def delete(self, *, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=self._key(key))


fake_object_storage = FakeObjectStorage()


def get_object_storage() -> ObjectStorage:
    provider = str(getattr(settings, "OBJECT_STORAGE_PROVIDER", "fake"))
    if provider == "fake":
        return fake_object_storage
    if provider == "local":
        return LocalFileObjectStorage()
    if provider == "r2":
        return R2ObjectStorage()
    raise DomainError(
        "STORAGE_NOT_CONFIGURED",
        "El proveedor de almacenamiento no es válido.",
        status=503,
    )
