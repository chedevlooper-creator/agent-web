# Component Patterns

Reusable patterns for this project's component library. All examples use Tailwind CSS v4 + shadcn/ui conventions.

## Chat Bubbles

### User Message
```tsx
<div className="flex gap-3 justify-end">
  <Card className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl">
    <CardContent className="p-3 text-sm">{content}</CardContent>
  </Card>
  <Avatar className="h-8 w-8">
    <AvatarFallback><User size={16} /></AvatarFallback>
  </Avatar>
</div>
```

### Assistant Message
```tsx
<div className="flex gap-3">
  <Avatar className="h-8 w-8 border-2 border-accent">
    <AvatarFallback><Bot size={16} /></AvatarFallback>
  </Avatar>
  <Card className="max-w-[85%] bg-surface border rounded-2xl">
    <CardContent className="p-3 text-sm prose dark:prose-invert max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </CardContent>
  </Card>
</div>
```

### Code Block (inside markdown)
```tsx
<SyntaxHighlighter
  style={vscDarkPlus}
  language={lang}
  PreTag="div"
  className="rounded-lg max-h-[400px] overflow-auto text-sm"
>
  {code}
</SyntaxHighlighter>
```

## Input Area

```tsx
<div className="flex gap-2 p-3 bg-surface-elevated rounded-xl border
                focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary
                transition-all">
  <textarea
    className="flex-1 bg-transparent resize-none text-sm placeholder:text-muted-foreground
               focus:outline-none min-h-[40px] max-h-[160px]"
    rows={1}
    placeholder="Type a message..."
  />
  <Button size="icon" className="h-8 w-8 rounded-xl shrink-0">
    <Send size={16} />
  </Button>
</div>
```

## Sidebar

### Container
```tsx
<aside className={cn(
  "h-screen border-r bg-surface transition-all duration-300",
  collapsed ? "w-16" : "w-[280px]"
)}>
```

### Session Item
```tsx
<button className={cn(
  "w-full h-11 px-3 rounded-lg text-left text-sm truncate",
  "hover:bg-muted/50 transition-colors",
  active && "bg-primary-muted border-l-2 border-primary font-medium"
)}>
  {title}
</button>
```

## Panels

### Settings / Context Panel
```tsx
<aside className="w-[320px] h-screen border-l bg-surface overflow-y-auto">
  <div className="sticky top-0 p-4 bg-surface/80 backdrop-blur-sm border-b z-10">
    <h2 className="text-sm font-semibold">Settings</h2>
  </div>
  <div className="p-4 space-y-4">{children}</div>
</aside>
```

## Buttons

### Primary
```tsx
<Button className="bg-primary text-white shadow-sm hover:bg-primary/90 hover:shadow-md
                   active:scale-[0.97] transition-all">
  Action
</Button>
```

### Ghost
```tsx
<Button variant="ghost" className="hover:bg-muted/50 transition-colors">
  <Settings size={16} />
</Button>
```

### Icon Button
```tsx
<Button variant="ghost" size="icon"
        className="h-8 w-8 rounded-lg hover:bg-muted/50"
        aria-label="Clear chat">
  <Trash2 size={14} />
</Button>
```

## Cards

```tsx
<Card className="bg-surface border border-muted rounded-xl shadow-sm
                 hover:shadow-md hover:-translate-y-px transition-all">
  <CardContent className="p-4">{children}</CardContent>
</Card>
```

## Badges

```tsx
<Badge variant="outline" className="text-xs">{provider}</Badge>
<Badge variant="secondary" className="text-xs">{model}</Badge>
```

## Loading States

### Thinking Indicator
```tsx
<div className="flex gap-2 items-center text-muted-foreground text-sm" role="status">
  <Loader2 className="animate-spin" size={16} />
  <span>Thinking...</span>
</div>
```

### Skeleton
```tsx
<div className="animate-pulse space-y-2">
  <div className="h-4 bg-muted rounded w-3/4" />
  <div className="h-4 bg-muted rounded w-1/2" />
</div>
```

## Dropdown Menu

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">
      <Settings size={14} className="mr-1" /> Settings
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-72 p-4 space-y-3">
    {/* Form fields here */}
  </DropdownMenuContent>
</DropdownMenu>
```

## Focus Ring Pattern

Apply to all interactive elements:
```tsx
className="focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
           focus-visible:ring-offset-background outline-none"
```

## Empty States

```tsx
<div className="text-center text-muted-foreground py-20 space-y-2">
  <MessageSquare size={40} className="mx-auto opacity-50" />
  <p className="text-sm">No messages yet. Start a conversation.</p>
</div>
```
