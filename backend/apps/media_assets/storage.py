"""R2-compatible private object storage boundary."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import quote

import boto3
from django.conf import settings

from tenda.errors import DomainError


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
        import hashlib

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
                "Key": key,
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
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in_seconds,
            )
        )

    def head(self, *, key: str) -> StoredObject:
        try:
            result = self.client.head_object(Bucket=self.bucket, Key=key)
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
            result = self.client.get_object(Bucket=self.bucket, Key=key)
            return bytes(result["Body"].read())
        except Exception as exc:
            raise DomainError(
                "FILE_NOT_FOUND",
                "No encontramos el archivo.",
                status=404,
            ) from exc

    def write_bytes(self, *, key: str, content: bytes, content_type: str) -> StoredObject:
        import hashlib

        checksum = hashlib.sha256(content).hexdigest()
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
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
        self.client.delete_object(Bucket=self.bucket, Key=key)


fake_object_storage = FakeObjectStorage()


def get_object_storage() -> ObjectStorage:
    provider = str(getattr(settings, "OBJECT_STORAGE_PROVIDER", "fake"))
    if provider == "fake":
        return fake_object_storage
    if provider == "r2":
        return R2ObjectStorage()
    raise DomainError(
        "STORAGE_NOT_CONFIGURED",
        "El proveedor de almacenamiento no es válido.",
        status=503,
    )
