// Simple placeholders to keep imports working. Not used in current App.
export function Tabs({children}){ return children }
export function TabsList({children}){ return <div className="flex gap-2">{children}</div> }
export function TabsTrigger({children}){ return <button className="px-3 py-1 rounded-lg border">{children}</button> }
export function TabsContent({children}){ return <div className="mt-2">{children}</div> }
