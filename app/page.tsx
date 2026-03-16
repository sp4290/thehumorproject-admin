"use client";

import Link from "next/link";
import LoginButton from "@/components/LoginButton";

export default function Home() {
    return (
        <div style={{ padding: 40 }}>
            <LoginButton />

            <h1 style={{ marginTop: 20 }}>Humor Project Admin</h1>

            <p style={{ marginTop: 10 }}>
                Log in with Google, then open the admin dashboard.
            </p>

            <p style={{ marginTop: 10 }}>
                <Link href="/admin">Go to Admin Dashboard</Link>
            </p>
        </div>
    );
}