"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function HumorMixPage() {
    return (
        <AdminResourcePage
            title="Humor Mix"
            tableName="humor_flavor_mix"
            mode="update"
        />
    );
}