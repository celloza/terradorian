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

class ManualIngestSchema(BaseModel):
    component_id: str
    environment: str
    terraform_plan: Dict[str, Any]
