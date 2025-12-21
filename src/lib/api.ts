// src/lib/api.ts
const API_URL = "http://localhost:8000";

export const ApiService = {
  generateSchema: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_URL}/generate-schema`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Server failed to process image");
    }
    let result = res.json();
    console.log()
    return result;
  }
};