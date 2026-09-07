'use client';
/* oxlint-disable next/no-img-element -- Tool portraits are generated data URLs, already sized for the picker. */
import { ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle, PopoverDescription } from '@/components/ui/popover';
import { toolShortcut } from '@/lib/game/tool-info';

export function ToolPicker({open,onOpenChange,tool,icons,items,onSelect,touch}:{open:boolean;onOpenChange:(open:boolean)=>void;tool:number;icons:string[];items:readonly {name:string;description:string}[];onSelect:(tool:number)=>void;touch:boolean}) {
  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger className="equipped-tool" aria-label={`Change tool: ${items[tool].name}`}>
      {icons[tool]&&<img src={icons[tool]} alt="" width={38} height={38} draggable={false}/>}
      <span><small>EQUIPPED</small><strong>{items[tool].name}</strong></span><ChevronsUpDown size={16}/>
    </PopoverTrigger>
    <PopoverContent side="top" align="end" sideOffset={10} className="tool-picker-panel" onKeyDown={event=>{const index=toolShortcut(event.code);if(index!==null){event.preventDefault();event.stopPropagation();onSelect(index);}}}>
      <div className="tool-picker-heading"><PopoverTitle>Pick your next pop.</PopoverTitle>{!touch&&<kbd>T</kbd>}</div>
      <PopoverDescription className="tool-picker-description">{touch?'Choose a tool to get back to it.':`Choose a tool · 1–${items.length} and scroll also switch.`}</PopoverDescription>
      <fieldset className="tool-picker-grid" aria-label="Choose a tool">
        {items.map((item,i)=><button type="button" key={item.name} aria-label={`${i+1}: ${item.name}`} aria-pressed={i===tool} title={item.description} onClick={()=>onSelect(i)}>
          <kbd>{i+1}</kbd>{i===tool&&<Check className="tool-check" size={14}/>}
          {icons[i]&&<img src={icons[i]} alt="" width={58} height={58} draggable={false}/>}
          <span>{item.name}</span>
        </button>)}
      </fieldset>
    </PopoverContent>
  </Popover>;
}
