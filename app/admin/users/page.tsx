"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function UsersPage() {
    return (
        <AdminResourcePage
            title="Users / Profiles"
            tableName="profiles"
            mode="read"
        />
    );
}