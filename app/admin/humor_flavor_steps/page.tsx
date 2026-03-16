"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function HumorFlavorStepsPage() {
    return (
        <AdminResourcePage
            title="Humor Flavor Steps"
            tableName="humor_flavor_steps"
            mode="read"
        />
    );
}