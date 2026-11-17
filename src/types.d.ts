export type Category='personal'|'rankdaily'|'twitch'|'cs2'|'sport'|'study';
export type Recurrence='none'|'daily'|'weekdays'|'weekly';
export type Task={id:string;title:string;dueDate:string;time:string;category:Category;recurrence:Recurrence;note:string;completions:string[];createdAt:string};
export type TaskInput=Pick<Task,'title'|'dueDate'|'time'|'category'|'recurrence'|'note'>;
export type PlanChange={action:'create'|'reschedule';task_id:string;title:string;category:Category;date:string;time:string;note:string;recurrence:Recurrence;valid?:boolean};
export type Plan={summary:string;changes:PlanChange[];spent:number};
export type UpdateState={status:string;message:string;version:string};
export type ChatSnippet={id:string;chat:string;date:string;excerpt:string};
export type ChatImport={scannedConversations:number;matchedMessages:number;candidates:ChatSnippet[]};
export type VideoDraft={file:string;size:number;modifiedAt:string;title?:string;description?:string;publishAt?:string;status?:string};
export type VideoInbox={inbox:string;videos:VideoDraft[]};
export type Snapshot={update:UpdateState;tasks:Task[];spent:number;limit:number;hasKey:boolean;autostart:boolean;evening:boolean;model:string};
declare global {
  interface Window { lifehub:{
    load:()=>Promise<Snapshot>;
    addTask:(task:TaskInput)=>Promise<Task>;
    editTask:(id:string,task:TaskInput)=>Promise<Task>;
    deleteTask:(id:string)=>Promise<boolean>;
    toggleTask:(id:string,date:string)=>Promise<boolean>;
    setKey:(key:string)=>Promise<boolean>;
    removeKey:()=>Promise<boolean>;
    aiPlan:(prompt:string,today:string)=>Promise<Plan>;
    applyPlan:(changes:PlanChange[])=>Promise<number>;
    setAutostart:(enabled:boolean)=>Promise<boolean>;
    setEvening:(enabled:boolean)=>Promise<boolean>;
    exportData:()=>Promise<boolean>;
    importChats:()=>Promise<ChatImport|null>;
    proposeChats:(ids:string[],today:string)=>Promise<Plan>;
    listVideos:()=>Promise<VideoInbox>;
    openInbox:()=>Promise<boolean>;
    importVideos:()=>Promise<string[]>;
    saveVideoDraft:(filename:string,meta:{title:string;description:string;publishAt:string})=>Promise<boolean>;
    checkUpdates:()=>Promise<UpdateState>;
    installUpdate:()=>Promise<boolean>;
    onUpdate:(cb:(state:UpdateState)=>void)=>()=>void;
    onChanged:(cb:()=>void)=>()=>void;
  } }
}
