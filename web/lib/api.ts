const API_BASE = "/api";

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

export const updateComponent = async (component_id: string, project_id: string, updates: any) => {
    const res = await fetch(`${API_BASE}/update_component`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component_id, project_id, ...updates }),
    });
    if (!res.ok) throw new Error("Failed to update component");
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
export const manualIngest = async (component_id: string, environment: string, branch: string, terraform_plan: any) => {
    const res = await fetch(`${API_BASE}/manual_ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component_id, environment, branch, terraform_plan }),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to ingest plan: ${errorText}`);
    }
    return res.json();
};

export const listPlans = (project_id: string, component_id?: string, environment?: string, branch?: string) => {
    let url = `/list_plans?project_id=${project_id}`;
    if (component_id) {
        url += `&component_id=${component_id}`;
    }
    if (environment) {
        url += `&environment=${environment}`;
    }
    if (branch) {
        url += `&branch=${branch}`;
    }
    return url;
};

export const deleteComponent = async (component_id: string, project_id: string) => {
    const res = await fetch(`${API_BASE}/delete_component`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component_id, project_id }),
    });
    if (!res.ok) throw new Error("Failed to delete component");
    return true;
};

export const deleteEnvironment = async (project_id: string, environment: string) => {
    const res = await fetch(`${API_BASE}/delete_environment`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id, environment }),
    });
    if (!res.ok) throw new Error("Failed to delete environment");
    return true;
};

export const deletePlan = async (plan_id: string) => {
    const res = await fetch(`${API_BASE}/delete_plan/${plan_id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to delete plan");
    return true;
};

export const updateProjectSettings = async (project_id: string, settings: any) => {
    const res = await fetch(`${API_BASE}/update_project_settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id, ...settings }),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    return res.json();
};

export const getPlan = async (plan_id: string) => {
    const res = await fetch(`${API_BASE}/get_plan?plan_id=${plan_id}`);
    if (!res.ok) throw new Error("Failed to fetch plan");
    return res.json();
};
