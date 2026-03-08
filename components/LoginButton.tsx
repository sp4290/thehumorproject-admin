"use client"

import { supabase } from "@/lib/supabase"
import { useEffect, useState } from "react"

export default function LoginButton() {

    const [user,setUser] = useState<any>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({data})=>{
            setUser(data.user)
        })
    },[])

    const login = async () => {

        await supabase.auth.signInWithOAuth({
            provider:"google",
            options:{
                redirectTo:`${window.location.origin}/auth/callback`
            }
        })

    }

    const logout = async () => {
        await supabase.auth.signOut()
        window.location.reload()
    }

    return (
        <div>

            {!user ? (
                <button onClick={login}>Login with Google</button>
            ):(
                <button onClick={logout}>Logout</button>
            )}

        </div>
    )
}