import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { cn } from "../../lib/utils"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

const ToastProvider = ToastPrimitive.Provider

export type ToastMessage = {
  title: string
  description: string
  variant: ToastVariant
}

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed z-[100] flex max-h-screen flex-col",
      className
    )}
    style={{ 
      top: '8px',
      right: '8px',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      alignItems: 'flex-end'
    }}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

type ToastVariant = "neutral" | "success" | "error"

interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: ToastVariant
  swipeDirection?: "right" | "left" | "up" | "down"
}

const toastVariants: Record<
  ToastVariant,
  { icon: React.ReactNode; bgColor: string }
> = {
  neutral: {
    icon: <Info className="h-3 w-3 text-amber-700" />,
    bgColor: "bg-amber-100"
  },
  success: {
    icon: <CheckCircle2 className="h-3 w-3 text-emerald-700" />,
    bgColor: "bg-emerald-100"
  },
  error: {
    icon: <AlertCircle className="h-3 w-3 text-red-700" />,
    bgColor: "bg-red-100"
  }
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant = "neutral", ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    duration={4000}
    className={cn(
      "group pointer-events-auto relative overflow-hidden rounded-md border-l-4",
      toastVariants[variant].bgColor,
      className
    )}
    style={{ 
      width: '300px', 
      minWidth: '300px', 
      maxWidth: '300px',
      flexShrink: 0,
      flexGrow: 0,
      height: 'auto',
      boxSizing: 'border-box',
      padding: '12px'
    }}
    {...props}
  >
    <div className="flex items-center gap-2" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="flex-shrink-0">
        {toastVariants[variant].icon}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        {props.children}
      </div>
    </div>
    <ToastPrimitive.Close className="absolute right-2 top-2 rounded-md p-0.5 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100 flex-shrink-0">
      <X className="h-2 w-2" />
    </ToastPrimitive.Close>
  </ToastPrimitive.Root>
))
Toast.displayName = ToastPrimitive.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "text-[0.65rem] font-medium text-zinc-600 hover:text-zinc-900",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitive.Action.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-[0.7rem] font-medium text-zinc-900 overflow-hidden", className)}
    style={{ 
      maxWidth: '100%',
      display: '-webkit-box',
      WebkitLineClamp: 1,
      WebkitBoxOrient: 'vertical',
      wordBreak: 'break-word'
    }}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitive.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-[0.65rem] text-zinc-600 overflow-hidden", className)}
    style={{ 
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      wordBreak: 'break-word',
      maxWidth: '100%'
    }}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitive.Description.displayName

export type { ToastProps, ToastVariant }
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastAction,
  ToastTitle,
  ToastDescription
}
