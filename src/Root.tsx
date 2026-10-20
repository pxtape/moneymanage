import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import AuthScreen from './AuthScreen';
import AccountSpace from './AccountSpace';
import { supabase } from './supabase';
export default function Root(){
 const [session,setSession]=useState<Session|null>(null);const [view,setView]=useState<'demo'|'account'>('account');const [initializing,setInitializing]=useState(true);
 useEffect(()=>{let active=true;const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{if(!active)return;setSession(next);setInitializing(false);if((event==='INITIAL_SESSION'&&next)||event==='SIGNED_IN'||event==='PASSWORD_RECOVERY')setView('account');if(event==='SIGNED_OUT')setView('account')});void supabase.auth.getSession().then(({data,error})=>{if(active){setSession(error?null:data.session);setInitializing(false);if(data.session&&!error)setView('account')}}).catch(()=>{if(active)setInitializing(false)});return()=>{active=false;subscription.unsubscribe()}},[]);
 if(initializing)return <div className="app app-loading" role="status">กำลังเปิด MONEYSPACE…</div>;
 if(view==='demo')return <App onSignIn={()=>setView('account')} signedIn={!!session}/>;
 return session?<AccountSpace key={session.user.id} user={session.user} onDemo={()=>setView('demo')} onExit={()=>{setSession(null);setView('account')}}/>:<AuthScreen onDemo={()=>setView('demo')}/>;
}
