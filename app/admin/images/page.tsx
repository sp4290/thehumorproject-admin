"use client";

import { supabase } from "@/lib/supabase";
import { useEffect,useState } from "react";

export default function Images(){

    const [images,setImages] = useState<any[]>([]);
    const [url,setUrl] = useState("");

    const load = async ()=>{

        const {data} = await supabase
            .from("images")
            .select("*")
            .limit(100);

        setImages(data || []);

    };

    useEffect(()=>{
        load();
    },[]);

    const createImage = async ()=>{

        await supabase
            .from("images")
            .insert({url});

        setUrl("");
        load();

    };

    const deleteImage = async (id:string)=>{

        await supabase
            .from("images")
            .delete()
            .eq("id",id);

        load();

    };

    return(

        <div style={{padding:40}}>

            <h1>Images</h1>

            <input
                value={url}
                onChange={(e)=>setUrl(e.target.value)}
                placeholder="Image URL"
            />

            <button onClick={createImage}>
                Create
            </button>

            {images.map(img=>(
                <div key={img.id}>

                    <img src={img.url} width={200}/>

                    <button onClick={()=>deleteImage(img.id)}>
                        Delete
                    </button>

                </div>
            ))}

        </div>

    );

}