"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LoginButton from "@/components/LoginButton";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                router.push("/admin");
            }
        };

        checkUser();
    }, [router]);

    return (
        <div style={{ padding: 40 }}>
            <h1 style={{ marginTop: 0 }}>Humor Project Admin</h1>

            <p style={{ marginTop: 10 }}>
                Log in with Google to access the admin dashboard.
            </p>

            <div style={{ marginTop: 30 }}>
                <LoginButton />
            </div>
        </div>
    );
}