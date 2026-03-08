"use client";

import LoginButton from "@/components/LoginButton";

export default function Home(){

    return (

        <div style={{padding:40}}>

            <LoginButton/>

            <h1 style={{marginTop:20}}>Humor Project Admin</h1>

            <p style={{marginTop:10}}>
                Login then go to <a href="/admin">Admin Dashboard</a>
            </p>

        </div>

    );
}