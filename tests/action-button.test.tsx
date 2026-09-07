import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { UseToolButton } from '../components/game/use-tool-button';
await test('every tool exposes a named, visible action and the F shortcut without device or mouse-lock requirements',()=>{
  for(const [tool,label] of ['POP','SMASH','WHACK','THROW','FIRE','THROW BOMB','LAUNCH','BOWL','VACUUM'].entries()){
    const html=renderToStaticMarkup(<UseToolButton tool={tool} held={false} onDown={()=>{}} onUp={()=>{}} onTap={()=>{}}/>);
    assert.ok(html.includes(`<strong>${label}</strong>`));
    assert.ok(html.includes('aria-label="Use tool:'));
    assert.ok(html.includes('<kbd>F</kbd>'));
    assert.ok(!html.includes('disabled'));
  }
});
