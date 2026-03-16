"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function AllowedSignupDomainsPage() {
    return (
        <AdminResourcePage
            title="Allowed Signup Domains"
            tableName="allowed_signup_domains"
            mode="crud"
        />
    );
}