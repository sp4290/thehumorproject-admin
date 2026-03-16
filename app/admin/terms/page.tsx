"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function TermsPage() {
    return (
        <AdminResourcePage
            title="Terms"
            tableName="terms"
            mode="crud"
        />
    );
}