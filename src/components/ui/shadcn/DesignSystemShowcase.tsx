"use client"

import { useState } from "react"
import { 
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Input, Badge, Dialog, DialogHeader, DialogTitle, DialogContent, DialogDescription, DialogFooter, DialogTrigger, DialogClose,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectLabel, SelectGroup, SelectSeparator
} from "@/components/ui/shadcn"
import { Mail, Settings, User } from "lucide-react"

export function DesignSystemShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="p-8 space-y-8">
      {/* 颜色展示 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">色彩系统</h2>
        <div className="flex gap-4 flex-wrap">
          <Badge variant="default">Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Error</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>

      {/* 按钮展示 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">按钮</h2>
        <div className="flex gap-3 flex-wrap">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex gap-3 mt-3 flex-wrap">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon"><Settings className="h-4 w-4" /></Button>
        </div>
      </section>

      {/* 输入框 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">输入框</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <Input placeholder="Basic Input" />
          <Input placeholder="Disabled" disabled />
        </div>
      </section>

      {/* 卡片 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">卡片</h2>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description text goes here.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Card content with some additional information.</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">Action</Button>
              <Button size="sm" variant="ghost">Cancel</Button>
            </CardFooter>
          </Card>
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Stat Card</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">98.5%</div>
              <p className="text-sm text-muted-foreground mt-1">SEO Score</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 标签页 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">标签页</h2>
        <Tabs defaultValue="overview" className="max-w-xl">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardContent className="pt-4">
                <p>Overview content goes here...</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="analytics">
            <Card>
              <CardContent className="pt-4">
                <p>Analytics data visualization...</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="reports">
            <Card>
              <CardContent className="pt-4">
                <p>Generated reports...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* 选择器 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">选择器</h2>
        <Select>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Options</SelectLabel>
              <SelectItem value="seo">SEO Audit</SelectItem>
              <SelectItem value="geo">GEO Analysis</SelectItem>
              <SelectItem value="content">Content Strategy</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>

      {/* 对话框 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">对话框</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
              <DialogDescription>
                Are you sure you want to proceed with this action?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  )
}
