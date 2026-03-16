"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function LoginButton() {
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMounted(true);

        supabase.auth.getUser().then(({ data }) => {
            setUser(data.user);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const login = async () => {
        setLoading(true);

        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    const logout = async () => {
        setLoading(true);

        await supabase.auth.signOut();

        window.location.href = "/";
    };

    if (!mounted) {
        return <button disabled>Loading...</button>;
    }

    return (
        <div>
            {!user ? (
                <button onClick={login} disabled={loading}>
                    {loading ? "Loading..." : "Login with Google"}
                </button>
            ) : (
                <button onClick={logout} disabled={loading}>
                    {loading ? "Logging out..." : "Logout"}
                </button>
            )}
        </div>
    );
}