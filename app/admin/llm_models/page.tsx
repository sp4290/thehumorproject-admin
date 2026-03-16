"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function LlmModelsPage() {
    return (
        <AdminResourcePage
            title="LLM Models"
            tableName="llm_models"
            mode="crud"
        />
    );
}