const http=require("http");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const PORT=Number(process.env.PORT)||10000,HOST="0.0.0.0",ROOT=__dirname;
const DATA_DIR=path.join(ROOT,"data"),DATA_FILE=path.join(DATA_DIR,"site.json");
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"",ADMIN_EMAIL=process.env.ADMIN_EMAIL||"admin@nexoraweb.local",sessions=new Map();
if(!ADMIN_PASSWORD)console.warn("WARNING: Set ADMIN_PASSWORD in production.");
const MIME={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp"};
function ensureData(){fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(DATA_FILE))fs.writeFileSync(DATA_FILE,JSON.stringify({settings:{brand:"Nexora WEB",tagline:"Premium digital experiences for ambitious brands.",email:"hello@nexoraweb.com",phone:"",whatsapp:""},hero:{eyebrow:"NEXORA WEB · PREMIUM DIGITAL STUDIO",title:"We build digital experiences that move businesses forward.",description:"High-performance websites, e-commerce platforms and custom web solutions designed for modern brands."},services:[],leads:[]},null,2))}
function readData(){ensureData();return JSON.parse(fs.readFileSync(DATA_FILE,"utf8"))}
function writeData(d){fs.writeFileSync(DATA_FILE,JSON.stringify(d,null,2))}
function json(res,status,d){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(d))}
function isAdmin(req){const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");return !!t&&sessions.has(t)}
function parseBody(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>1000000)req.destroy()});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{})}catch(e){reject(e)}});req.on("error",reject)})}
async function api(req,res,url){
if(req.method==="POST"&&url==="/api/login"){const b=await parseBody(req);if(String(b.password||"")!==ADMIN_PASSWORD)return json(res,401,{error:"Invalid password"});const t=crypto.randomBytes(32).toString("hex");sessions.set(t,Date.now());return json(res,200,{token:t})}
if(req.method==="GET"&&url==="/api/site")return json(res,200,readData());
if(req.method==="POST"&&url==="/api/leads"){const b=await parseBody(req);if(!b.name||!b.email||!b.message)return json(res,400,{error:"Name, email and message are required"});const d=readData();d.leads.push({id:crypto.randomUUID(),name:String(b.name).slice(0,120),email:String(b.email).slice(0,180),message:String(b.message).slice(0,4000),status:"new",createdAt:new Date().toISOString()});writeData(d);return json(res,201,{ok:true})}
if(req.method==="PUT"&&url==="/api/site"){if(!isAdmin(req))return json(res,401,{error:"Unauthorized"});const b=await parseBody(req),d=readData();const next={...d,...b,settings:{...d.settings,...(b.settings||{})},hero:{...d.hero,...(b.hero||{})},services:Array.isArray(b.services)?b.services:d.services,leads:d.leads};writeData(next);return json(res,200,next)}
if(req.method==="GET"&&url==="/api/leads"){if(!isAdmin(req))return json(res,401,{error:"Unauthorized"});return json(res,200,readData().leads)}
if(req.method==="PATCH"&&url.startsWith("/api/leads/")){if(!isAdmin(req))return json(res,401,{error:"Unauthorized"});const b=await parseBody(req),d=readData(),id=url.split("/").pop(),lead=d.leads.find(x=>x.id===id);if(!lead)return json(res,404,{error:"Lead not found"});if(b.status)lead.status=String(b.status);writeData(d);return json(res,200,lead)}
if(req.method==="POST"&&url==="/api/logout"){const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");sessions.delete(t);return json(res,200,{ok:true})}
return json(res,404,{error:"Not found"})}
function safeFile(reqUrl){const rel=decodeURIComponent(reqUrl.split("?")[0]).replace(/^\/+/,"")||"index.html";const f=path.resolve(ROOT,rel);return f.startsWith(ROOT+path.sep)?f:null}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,"http://localhost").pathname;if(u.startsWith("/api/"))return await api(req,res,u);const f=safeFile(req.url);if(!f)return json(res,403,{error:"Forbidden"});fs.stat(f,(err,st)=>{if(err||!st.isFile())return json(res,404,{error:"Not found"});res.writeHead(200,{"Content-Type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream","X-Content-Type-Options":"nosniff"});fs.createReadStream(f).pipe(res)})}catch(e){console.error(e);json(res,500,{error:"Server error"})}});
ensureData();server.listen(PORT,HOST,()=>console.log("Nexora WEB running on "+PORT));