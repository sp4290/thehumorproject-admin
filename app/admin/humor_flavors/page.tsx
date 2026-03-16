"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function HumorFlavorsPage() {
    return (
        <AdminResourcePage
            title="Humor Flavors"
            tableName="humor_flavors"
            mode="read"
        />
    );
}