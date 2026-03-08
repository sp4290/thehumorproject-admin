"use client";

import { supabase } from "@/lib/supabase";
import { useEffect,useState } from "react";

export default function Users(){

    const [users,setUsers] = useState<any[]>([]);

    useEffect(()=>{

        const load = async ()=>{

            const {data} = await supabase
                .from("profiles")
                .select("*")
                .limit(100);

            setUsers(data || []);

        };

        load();

    },[]);

    return(

        <div style={{padding:40}}>

            <h1>Users</h1>

            {users.map(u=>(
                <div key={u.id}>
                    {u.email}
                </div>
            ))}

        </div>

    );

}