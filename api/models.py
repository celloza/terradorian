from pydantic import BaseModel, Field
from typing import Dict, Any

class PlanSchema(BaseModel):
    project_name: str | None = None
    component_name: str | None = None
    environment: str = "dev"
    terraform_plan: Dict[str, Any]
    terraform_version: str | None = None
    providers: list[str] | None = None
    cloud_platform: str | None = None

class CreateProjectSchema(BaseModel):
    name: str
    description: str | None = None
    environments: list[str] | None = ["dev"]

class AddEnvironmentSchema(BaseModel):
    project_id: str
    environment: str

class CreateComponentSchema(BaseModel):
    project_id: str
    name: str
    excluded_environments: list[str] = []

class UpdateComponentSchema(BaseModel):
    component_id: str
    project_id: str
    excluded_environments: list[str] | None = None
    name: str | None = None

class ManualIngestSchema(BaseModel):
    component_id: str
    environment: str
    terraform_plan: Dict[str, Any]

class AuthSettingsSchema(BaseModel):
    client_id: str
    client_secret: str
    tenant_id: str

class SlackSettings(BaseModel):
    enabled: bool = False
    webhook_url: str | None = None

class EmailSchedule(BaseModel):
    day: str = "Monday"
    time: str = "09:00" # UTC

class SmtpSettings(BaseModel):
    host: str = ""
    port: int = 587
    username: str = ""
    password: str = ""
    secure: bool = True

class EmailSettings(BaseModel):
    enabled: bool = False
    recipients: list[str] = []
    schedule: EmailSchedule = EmailSchedule()
    smtp: SmtpSettings = SmtpSettings()

class NotificationSettings(BaseModel):
    slack: SlackSettings = SlackSettings()
    email: EmailSettings = EmailSettings()

class UpdateProjectSettingsSchema(BaseModel):
    project_id: str
    notifications: NotificationSettings | None = None
    description: str | None = None
    environments: list[str] | None = None
