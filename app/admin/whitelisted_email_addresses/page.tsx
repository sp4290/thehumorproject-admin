"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function WhitelistedEmailAddressesPage() {
    return (
        <AdminResourcePage
            title="Whitelisted Email Addresses"
            tableName="whitelist_email_addresses"
            mode="crud"
        />
    );
}