import {Link} from 'react-router-dom';
import {WarmBack} from '@/components/warm/WarmBack';
import {WarmTitle} from '@/components/warm/WarmPage';
import {WarmIcon} from '@/components/warm/WarmIcon';
import {RunnerScene} from './RunnerScene';
import './runner.css';

export function HubPage(){
  return <section className="hub-page factory-run">
    <WarmBack to="/" label="На главную"/>
    <WarmTitle title="Hub" description="Игры и небольшие проекты команды."/>
    <Link to="/hub/factory-run" className="hub-project">
      <div className="hub-project-art"><RunnerScene/></div>
      <div className="hub-project-copy"><div><h2>Factory Run</h2><p>Прокатись по пивоварне. Собери хмель, обойди бочки.</p></div><span className="hub-project-launch">Играть<WarmIcon name="chevron" size={20}/></span></div>
    </Link>
  </section>;
}
