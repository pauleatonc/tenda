"""Identity persistence for Tenda.

Database primary keys stay private. Every identifier exposed by an adapter uses
``public_id`` instead.
"""

from __future__ import annotations

import uuid
from typing import Any, ClassVar, cast

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models, transaction
from django.utils import timezone


class UserManager(BaseUserManager):  # type: ignore[type-arg]
    """Create users whose canonical login identifier is their email."""

    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields: Any) -> User:
        if not email:
            raise ValueError("El correo es obligatorio")
        canonical_email = self.normalize_email(email).strip().lower()
        with transaction.atomic():
            user = cast(User, self.model(email=canonical_email, **extra_fields))
            if password:
                user.set_password(password)
            else:
                user.set_unusable_password()
            user.full_clean(exclude={"password"})
            user.save(using=self._db)
            Profile.objects.create(user=user)
        return user

    def create_user(
        self,
        email: str,
        password: str | None = None,
        **extra_fields: Any,
    ) -> User:
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(
        self,
        email: str,
        password: str | None = None,
        **extra_fields: Any,
    ) -> User:
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("email_verified_at", timezone.now())
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Un superusuario debe tener is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Un superusuario debe tener is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user authenticated exclusively by canonical email."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    email = models.EmailField(unique=True, max_length=254)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    session_version = models.PositiveIntegerField(default=1)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    class Meta:
        ordering = ("email",)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.email = self.__class__.objects.normalize_email(self.email).strip().lower()
        super().save(*args, **kwargs)

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None

    def __str__(self) -> str:
        return self.email


class Profile(models.Model):
    """Non-authentication personal data kept separate from credentials."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    locale = models.CharField(max_length=16, default="es-CL")
    photo_asset_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.full_name or self.user.email


class ExpiringUserToken(models.Model):
    """Shared persisted shape for one-time, hashed auth tokens."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token_digest = models.CharField(max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ("-created_at",)

    @property
    def is_usable(self) -> bool:
        return self.consumed_at is None and self.expires_at > timezone.now()


class EmailVerificationToken(ExpiringUserToken):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification_tokens",
    )

    def __str__(self) -> str:
        return f"Verificación · {self.user.email} · {self.public_id}"


class PasswordResetToken(ExpiringUserToken):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )

    def __str__(self) -> str:
        return f"Recuperación · {self.user.email} · {self.public_id}"


class MobileSession(models.Model):
    """Revocable bearer credential metadata; the raw token is never persisted."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="mobile_sessions")
    token_prefix = models.CharField(max_length=16, db_index=True, editable=False)
    token_digest = models.CharField(max_length=64, unique=True, editable=False)
    active_organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    active_inventory = models.ForeignKey(
        "inventory.Inventory",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    device_name = models.CharField(max_length=120, blank=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.user.email} · {self.token_prefix}"

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > timezone.now() and self.user.is_active


class SocialIdentity(models.Model):
    """Verified provider subject linked to one Tenda user."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="social_identities")
    provider = models.CharField(max_length=32)
    subject = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("provider", "subject"),
                name="users_social_identity_unique",
            )
        ]

    def __str__(self) -> str:
        return f"{self.provider}:{self.subject}"


class OIDCLoginState(models.Model):
    """Single-use state for provider redirects."""

    class Client(models.TextChoices):
        WEB = "web", "Web"
        MOBILE = "mobile", "Mobile"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    state_digest = models.CharField(max_length=64, unique=True, editable=False)
    provider = models.CharField(max_length=32)
    client = models.CharField(max_length=12, choices=Client.choices)
    return_to = models.CharField(max_length=500, blank=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.provider} · {self.client} · {self.public_id}"


class AuthRateLimitBucket(models.Model):
    """Durable fixed-window counters without retaining email or IP values."""

    action = models.CharField(max_length=40)
    key_digest = models.CharField(max_length=64)
    window_started_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
    blocked_until = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("action", "key_digest"),
                name="users_auth_rate_bucket_unique",
            )
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.key_digest[:10]}"
