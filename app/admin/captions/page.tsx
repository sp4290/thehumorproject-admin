"use client";

import { supabase } from "@/lib/supabase";
import { useEffect,useState } from "react";

export default function Captions(){

    const [captions,setCaptions] = useState<any[]>([]);

    useEffect(()=>{

        const load = async ()=>{

            const {data} = await supabase
                .from("captions")
                .select("*")
                .limit(100);

            setCaptions(data || []);

        };

        load();

    },[]);

    return(

        <div style={{padding:40}}>

            <h1>Captions</h1>

            {captions.map(c=>(
                <div key={c.id}>
                    {c.content}
                </div>
            ))}

        </div>

    );

}