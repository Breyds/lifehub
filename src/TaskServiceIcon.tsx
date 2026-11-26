import {Youtube,Twitch,Github,Music2,Send,Gamepad2,BookOpen,Clapperboard} from 'lucide-react';
import './life-planner.css';
const services=[
 {name:'YouTube',pattern:/youtube|ютуб|ютюб|rank\s*daily/i,Icon:Youtube,color:'#ff4545'},
 {name:'Twitch',pattern:/twitch|твіч|твич/i,Icon:Twitch,color:'#a970ff'},
 {name:'GitHub',pattern:/github|гітхаб|гитхаб/i,Icon:Github,color:'#eee'},
 {name:'TikTok',pattern:/tik\s*tok|тік\s*ток|тик\s*ток/i,Icon:Music2,color:'#5ce6dc'},
 {name:'Spotify',pattern:/spotify|спотіфай|спотифай/i,Icon:Music2,color:'#1ed760'},
 {name:'Telegram',pattern:/telegram|телеграм/i,Icon:Send,color:'#36afe8'},
 {name:'CS2',pattern:/\bcs2\b|\bfaceit\b|контр.?страйк|кс2/i,Icon:Gamepad2,color:'#ecaa56'},
 {name:'Саморозвиток',pattern:/читати|читання|теорія ігор|теорії ігор|книжк|книг/i,Icon:BookOpen,color:'#8aaaff'},
 {name:'Аніме',pattern:/аніме|anime|аниме|netflix/i,Icon:Clapperboard,color:'#e1a9e6'}
];
export function TaskServiceIcon({title}:{title:string}){
 if(/duolingo|дуолінго|дуолинго|дуалінго|дуалинго/i.test(title))return <span className="lp-task-icon" title="Duolingo" aria-label="Duolingo"><svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="2" width="22" height="20" rx="7" fill="#58cc02"/><ellipse cx="8" cy="10" rx="4.5" ry="5.2" fill="#fff"/><ellipse cx="16" cy="10" rx="4.5" ry="5.2" fill="#fff"/><circle cx="8.7" cy="10" r="2.1" fill="#293c18"/><circle cx="15.3" cy="10" r="2.1" fill="#293c18"/><path d="M9 15h6l-3 4z" fill="#ffb525"/></svg></span>;
 const s=services.find(v=>v.pattern.test(title));return s?<span className="lp-task-icon" title={s.name} aria-label={s.name} style={{color:s.color}}><s.Icon size={16}/></span>:null;
}
