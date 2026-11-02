import * as React from 'react';
import {cn} from '@/lib/utils';
export const Input=React.forwardRef<HTMLInputElement,React.ComponentProps<'input'>>(({className,...props},ref)=><input ref={ref} className={cn('warm-input',className)} {...props}/>);
Input.displayName='Input';
