"use client";

import { supabase } from "@/lib/supabase";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";

export default function Admin(){

    const router = useRouter();

    const [stats,setStats] = useState({
        users:0,
        images:0,
        captions:0,
        votes:0
    });

    useEffect(()=>{

        const load = async ()=>{

            const {data:userData} = await supabase.auth.getUser();

            if(!userData.user){
                router.push("/");
                return;
            }

            const {data:profile} = await supabase
                .from("profiles")
                .select("is_superadmin")
                .eq("id",userData.user.id)
                .single();

            if(!profile?.is_superadmin){
                alert("Not authorized");
                router.push("/");
                return;
            }

            const [users,images,captions,votes] = await Promise.all([
                supabase.from("profiles").select("*",{count:"exact",head:true}),
                supabase.from("images").select("*",{count:"exact",head:true}),
                supabase.from("captions").select("*",{count:"exact",head:true}),
                supabase.from("caption_votes").select("*",{count:"exact",head:true})
            ]);

            setStats({
                users:users.count || 0,
                images:images.count || 0,
                captions:captions.count || 0,
                votes:votes.count || 0
            });

        };

        load();

    },[]);

    return(

        <div style={{padding:40}}>

            <h1>Admin Dashboard</h1>

            <p>Total Users: {stats.users}</p>
            <p>Total Images: {stats.images}</p>
            <p>Total Captions: {stats.captions}</p>
            <p>Total Votes: {stats.votes}</p>

            <br/>

            <a href="/admin/users">Users</a><br/>
            <a href="/admin/images">Images</a><br/>
            <a href="/admin/captions">Captions</a>

        </div>

    );

}