"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function LlmPromptChainsPage() {
    return (
        <AdminResourcePage
            title="LLM Prompt Chains"
            tableName="llm_prompt_chains"
            mode="read"
        />
    );
}