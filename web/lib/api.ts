const API_BASE = "http://localhost:7071/api";

export const fetcher = (url: string) => fetch(`${API_BASE}${url}`).then((res) => res.json());

// Projects
export const createProject = async (name: string, description: string) => {
    const res = await fetch(`${API_BASE}/create_project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error("Failed to create project");
    return res.json();
};

export const addEnvironment = async (project_id: string, environment: string) => {
    const res = await fetch(`${API_BASE}/add_environment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id, environment }),
    });
    if (!res.ok) throw new Error("Failed to add environment");
    return res.json();
};

// Getter returns URL for SWR
export const listProjects = () => "/list_projects";

// Components
export const createComponent = async (project_id: string, name: string) => {
    const res = await fetch(`${API_BASE}/create_component`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id, name }),
    });
    if (!res.ok) throw new Error("Failed to create component");
    return res.json();
};

// Getter returns URL for SWR
export const listComponents = (project_id: string) => {
    return `/list_components?project_id=${project_id}`;
};

// Tokens (PAT)
export const generatePat = async (project_id: string) => {
    const res = await fetch(`${API_BASE}/generate_pat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id }),
    });
    if (!res.ok) throw new Error("Failed to generate PAT");
    return res.json();
};

export const listTokens = (project_id: string) => {
    return `/list_tokens?project_id=${project_id}`;
};

export const revokeToken = async (project_id: string, token_id: string) => {
    const res = await fetch(`${API_BASE}/revoke_token`, {
        method: "POST", // using POST as per python code, though DELETE is often standard for revoke
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id, token_id }),
    });
    if (!res.ok) throw new Error("Failed to revoke token");
    return res.status === 204 ? true : res.json();
};

// Plans (Ingest)
export const manualIngest = async (component_id: string, environment: string, terraform_plan: any) => {
    const res = await fetch(`${API_BASE}/manual_ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component_id, environment, terraform_plan }),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to ingest plan: ${errorText}`);
    }
    return res.json();
};

export const listPlans = (project_id: string, environment?: string) => {
    let url = `/list_plans?project_id=${project_id}`;
    if (environment) {
        url += `&environment=${environment}`;
    }
    return url;
};
