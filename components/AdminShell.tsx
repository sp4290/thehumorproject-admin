"use client";

import { supabase } from "@/lib/supabase";
import { ReactNode, useEffect, useState } from "react";
import LoginButton from "@/components/LoginButton";

type State = "checking" | "not_logged_in" | "not_superadmin" | "ok";

const navLinks = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/images", label: "Images" },
    { href: "/admin/humor_flavors", label: "Humor Flavors" },
    { href: "/admin/humor_flavor_steps", label: "Humor Flavor Steps" },
    { href: "/admin/humor_mix", label: "Humor Mix" },
    { href: "/admin/terms", label: "Terms" },
    { href: "/admin/captions", label: "Captions" },
    { href: "/admin/caption_requests", label: "Caption Requests" },
    { href: "/admin/caption_examples", label: "Caption Examples" },
    { href: "/admin/llm_models", label: "LLM Models" },
    { href: "/admin/llm_providers", label: "LLM Providers" },
    { href: "/admin/llm_prompt_chains", label: "LLM Prompt Chains" },
    { href: "/admin/llm_responses", label: "LLM Responses" },
    { href: "/admin/allowed_signup_domains", label: "Allowed Signup Domains" },
    { href: "/admin/whitelisted_email_addresses", label: "Whitelisted Emails" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
    const [state, setState] = useState<State>("checking");
    const [email, setEmail] = useState("");

    useEffect(() => {
        const check = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setState("not_logged_in");
                return;
            }

            setEmail(user.email || "");

            const { data: profile, error } = await supabase
                .from("profiles")
                .select("is_superadmin")
                .eq("id", user.id)
                .single();

            if (error || !profile?.is_superadmin) {
                setState("not_superadmin");
                return;
            }

            setState("ok");
        };

        check();
    }, []);

    if (state === "checking") {
        return <div style={{ padding: 40 }}>Checking login...</div>;
    }

    if (state === "not_logged_in") {
        return (
            <div style={{ padding: 40 }}>
                <h1>Humor Project Admin</h1>
                <p>You must log in first to access the admin dashboard.</p>
                <LoginButton />
                <p style={{ marginTop: 20 }}>
                    <a href="/">Go back home</a>
                </p>
            </div>
        );
    }

    if (state === "not_superadmin") {
        return (
            <div style={{ padding: 40, maxWidth: 600 }}>
                <h1>Humor Project Admin</h1>

                <p style={{ marginTop: 10 }}>
                    Logged in as: <b>{email}</b>
                </p>

                <p style={{ marginTop: 20 }}>
                    Your account is logged in but it is not marked as <b>superadmin</b>.
                </p>

                <p>
                    You must set <b>is_superadmin = true</b> in the profiles table in Supabase.
                </p>

                {/* move logout button lower */}
                <div style={{ marginTop: 30 }}>
                    <LoginButton />
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", padding: 40 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 24,
                }}
            >
                <div>
                    <h1 style={{ margin: 0 }}>Humor Project Admin</h1>
                    <p style={{ marginTop: 8 }}>Logged in as: {email}</p>
                </div>

                <LoginButton />
            </div>

            <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
                <aside style={{ width: 260 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {navLinks.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                </aside>

                <main style={{ flex: 1 }}>{children}</main>
            </div>
        </div>
    );
}