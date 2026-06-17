"use client"

import { useState } from "react"
import { StatCard, StatGrid } from "@/components/ui/StatCard"
import { DashboardSection, MiniChart, ScoreRing, ProgressBar, StatusIndicator, ListItem } from "@/components/ui/DashboardWidgets"
import { QuickAction, QuickActionGrid } from "@/components/ui/QuickAction"
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Input,
  Dialog, DialogHeader, DialogTitle, DialogContent, DialogDescription, DialogFooter, DialogTrigger, DialogClose,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  Skeleton,
  Badge as ShadcnBadge,
  DataTable,
  ToastProvider,
  useToast,
  SonnerProvider,
  useSonner,
  Avatar, AvatarImage, AvatarFallback,
  Separator,
  Progress,
} from "@/components/ui/shadcn"
import { type ColumnDef } from "@tanstack/react-table"
import { 
  Search, Settings, Bell, Download, Plus, MoreHorizontal,
  TrendingUp, Users, Globe, DollarSign, Zap, ChevronRight,
  CheckCircle, AlertCircle, Info, AlertTriangle,
  Eye, Edit, Trash2, Copy
} from "lucide-react"

// 示例数据类型
interface User {
  id: string
  name: string
  email: string
  role: string
  status: "active" | "inactive" | "pending"
  score: number
  createdAt: string
}

const sampleUsers: User[] = [
  { id: "1", name: "张三", email: "zhangsan@example.com", role: "管理员", status: "active", score: 98, createdAt: "2024-01-15" },
  { id: "2", name: "李四", email: "lisi@example.com", role: "编辑", status: "active", score: 85, createdAt: "2024-02-20" },
  { id: "3", name: "王五", email: "wangwu@example.com", role: "访客", status: "pending", score: 72, createdAt: "2024-03-10" },
  { id: "4", name: "赵六", email: "zhaoliu@example.com", role: "编辑", status: "inactive", score: 65, createdAt: "2024-01-08" },
]

// Toast 演示组件
function ToastDemo() {
  const { addToast } = useToast()
  
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => addToast({ title: "操作成功", description: "数据已保存", type: "success" })}>
        <CheckCircle className="h-4 w-4 mr-1" /> Success
      </Button>
      <Button variant="outline" size="sm" onClick={() => addToast({ title: "发生错误", description: "请稍后重试", type: "error" })}>
        <AlertCircle className="h-4 w-4 mr-1" /> Error
      </Button>
      <Button variant="outline" size="sm" onClick={() => addToast({ title: "注意", description: "数据即将过期", type: "warning" })}>
        <AlertTriangle className="h-4 w-4 mr-1" /> Warning
      </Button>
      <Button variant="outline" size="sm" onClick={() => addToast({ title: "提示", description: "新功能已上线", type: "info" })}>
        <Info className="h-4 w-4 mr-1" /> Info
      </Button>
    </div>
  )
}

// Sonner 演示组件
function SonnerDemo() {
  const { toast } = useSonner()
  
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => toast({ title: "保存成功", type: "success" })}>
        Sonner Success
      </Button>
      <Button variant="outline" size="sm" onClick={() => toast({ title: "保存失败", description: "网络错误", type: "error" })}>
        Sonner Error
      </Button>
    </div>
  )
}

// 数据表示例
const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "用户名",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${row.original.name}`} />
          <AvatarFallback>{row.original.name[0]}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.email}</div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "角色",
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => {
      const status = row.original.status
      const styles = {
        active: "bg-success/10 text-success",
        inactive: "bg-muted text-muted-foreground",
        pending: "bg-warning/10 text-warning",
      }
      const labels = { active: "活跃", inactive: "停用", pending: "待审核" }
      return <ShadcnBadge className={styles[status]}>{labels[status]}</ShadcnBadge>
    },
  },
  {
    accessorKey: "score",
    header: "评分",
    cell: ({ row }) => <ScoreRing score={row.original.score} size={32} strokeWidth={3} />,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className="h-4 w-4 mr-2" />查看</DropdownMenuItem>
          <DropdownMenuItem><Edit className="h-4 w-4 mr-2" />编辑</DropdownMenuItem>
          <DropdownMenuItem><Copy className="h-4 w-4 mr-2" />复制</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />删除</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function UIShowcasePage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const trendData = [40, 45, 42, 48, 52, 49, 55]
  
  return (
    <TooltipProvider delayDuration={300}>
      <ToastProvider>
        <SonnerProvider>
          <div className="space-y-10">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">组件展示</h1>
                <p className="text-muted-foreground mt-1">GEO/SEO Console 设计系统 · v2.0</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusIndicator status="online" label="系统正常" pulse />
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  导出配置
                </Button>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  添加组件
                </Button>
              </div>
            </div>

            {/* 数据统计卡片 */}
            <DashboardSection eyebrow="// CORE METRICS" title="数据统计卡片">
              <StatGrid cols={4}>
                <StatCard
                  label="GEO 评分"
                  value={98.5}
                  suffix="分"
                  trend="up"
                  trendValue="+2.3%"
                  badge="优秀"
                  badgeVariant="success"
                  icon={<TrendingUp className="h-4 w-4" />}
                  sparklineData={trendData}
                />
                <StatCard
                  label="关键词排名"
                  value={1256}
                  suffix="个"
                  trend="up"
                  trendValue="+156 本月"
                  badge="增长中"
                  badgeVariant="info"
                  icon={<Globe className="h-4 w-4" />}
                  sparklineData={[1000, 1050, 1100, 1150, 1200, 1220, 1256]}
                />
                <StatCard
                  label="自然流量"
                  value={45.2}
                  suffix="K"
                  trend="up"
                  trendValue="+18.5%"
                  badge="创新高"
                  badgeVariant="success"
                  icon={<Users className="h-4 w-4" />}
                  progress={72}
                  sparklineData={[30, 32, 35, 38, 40, 43, 45]}
                />
                <StatCard
                  label="转化率"
                  value={3.8}
                  suffix="%"
                  trend="down"
                  trendValue="-0.2%"
                  badge="注意"
                  badgeVariant="warning"
                  icon={<DollarSign className="h-4 w-4" />}
                  sparklineData={[4.2, 4.0, 3.9, 4.1, 3.8, 3.9, 3.8]}
                />
              </StatGrid>
            </DashboardSection>

            {/* 进度条 & 状态指示 */}
            <DashboardSection eyebrow="// COMPONENTS" title="进度条 & 状态指示">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>进度条组件</CardTitle>
                    <CardDescription>多种颜色和尺寸</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ProgressBar value={75} color="primary" label="SEO 优化进度" showLabel />
                    <ProgressBar value={45} color="success" size="lg" label="内容覆盖率" showLabel />
                    <ProgressBar value={88} color="warning" size="sm" label="技术 SEO" showLabel />
                    <ProgressBar value={32} color="error" label="待修复问题" showLabel />
                    <Progress value={60} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>状态指示器</CardTitle>
                    <CardDescription>在线状态和脉冲动画</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                      <StatusIndicator status="online" label="在线" pulse />
                      <StatusIndicator status="offline" label="离线" />
                      <StatusIndicator status="warning" label="警告" />
                      <StatusIndicator status="error" label="错误" pulse />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <ListItem
                        title="GEO 评分达标"
                        description="当前评分 98.5 分"
                        leftIcon="✓"
                        rightContent={<ScoreRing score={98} size={40} />}
                      />
                      <ListItem
                        title="关键词监控中"
                        description="共监控 1,256 个关键词"
                        leftIcon="📊"
                        badge="活跃"
                        badgeVariant="success"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </DashboardSection>

            {/* 数据表格 */}
            <DashboardSection eyebrow="// DATA" title="高级数据表格">
              <Card>
                <CardContent className="pt-6">
                  <DataTable 
                    columns={columns} 
                    data={sampleUsers} 
                    searchKey="name"
                    searchPlaceholder="搜索用户..."
                  />
                </CardContent>
              </Card>
            </DashboardSection>

            {/* 按钮 & 徽章 */}
            <DashboardSection title="按钮 & 徽章">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>按钮组件</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">尺寸变体</div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button size="sm">Small</Button>
                        <Button size="default">Default</Button>
                        <Button size="lg">Large</Button>
                        <Button size="icon"><Settings className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">样式变体</div>
                      <div className="flex flex-wrap gap-2">
                        <Button>Default</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="destructive">Destructive</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="link">Link</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>徽章组件</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <ShadcnBadge variant="default">Default</ShadcnBadge>
                      <ShadcnBadge variant="secondary">Secondary</ShadcnBadge>
                      <ShadcnBadge variant="success">Success</ShadcnBadge>
                      <ShadcnBadge variant="warning">Warning</ShadcnBadge>
                      <ShadcnBadge variant="destructive">Error</ShadcnBadge>
                      <ShadcnBadge variant="info">Info</ShadcnBadge>
                      <ShadcnBadge variant="outline">Outline</ShadcnBadge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </DashboardSection>

            {/* 快捷入口 */}
            <DashboardSection eyebrow="// QUICK" title="快捷入口">
              <QuickActionGrid cols={2}>
                <QuickAction
                  title="页面诊断"
                  description="对网站页面进行 SEO 诊断"
                  icon="🔍"
                  href="/audits"
                  badge="推荐"
                  badgeVariant="info"
                />
                <QuickAction
                  title="关键词管理"
                  description="管理跟踪的关键词"
                  icon="📊"
                  href="/keywords"
                />
                <QuickAction
                  title="GEO 监测"
                  description="AI 搜索引擎表现监测"
                  icon="🤖"
                  href="/geo"
                  badge="新功能"
                  badgeVariant="success"
                />
                <QuickAction
                  title="任务看板"
                  description="可视化任务管理"
                  icon="📋"
                  href="/tasks/board"
                />
              </QuickActionGrid>
            </DashboardSection>

            {/* 通知系统 */}
            <DashboardSection title="通知系统">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Toast 通知</CardTitle>
                    <CardDescription>右上角弹出通知</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ToastDemo />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Sonner 轻量通知</CardTitle>
                    <CardDescription>更简洁的通知样式</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SonnerDemo />
                  </CardContent>
                </Card>
              </div>
            </DashboardSection>

            {/* 头像 & 分隔线 */}
            <DashboardSection title="头像 & 分隔线">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-6">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarImage src="https://api.dicebear.com/7.x/identicon/svg?seed=Admin" />
                      <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">张</AvatarFallback>
                    </Avatar>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">李</AvatarFallback>
                    </Avatar>
                    <Separator orientation="vertical" className="h-12" />
                    <Avatar>
                      <AvatarImage src="https://api.dicebear.com/7.x/bottts/svg?seed=bot" />
                      <AvatarFallback>🤖</AvatarFallback>
                    </Avatar>
                  </div>
                </CardContent>
              </Card>
            </DashboardSection>

            {/* 图表组件 */}
            <DashboardSection title="图表组件">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">趋势迷你图</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniChart data={trendData} color="primary" height={80} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">成功色</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniChart data={[20, 35, 30, 45, 50, 55, 60]} color="success" height={80} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">警告色</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniChart data={[60, 55, 50, 45, 40, 35, 30]} color="warning" height={80} />
                  </CardContent>
                </Card>
              </div>
            </DashboardSection>

            {/* 标签页 & 对话框 */}
            <DashboardSection title="标签页 & 对话框">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="pt-6">
                    <Tabs defaultValue="overview" className="w-full">
                      <TabsList>
                        <TabsTrigger value="overview">概览</TabsTrigger>
                        <TabsTrigger value="analytics">分析</TabsTrigger>
                        <TabsTrigger value="reports">报告</TabsTrigger>
                      </TabsList>
                      <TabsContent value="overview" className="mt-4">
                        <p className="text-sm text-muted-foreground">这是概览标签页的内容。</p>
                      </TabsContent>
                      <TabsContent value="analytics" className="mt-4">
                        <p className="text-sm text-muted-foreground">数据分析内容。</p>
                      </TabsContent>
                      <TabsContent value="reports" className="mt-4">
                        <p className="text-sm text-muted-foreground">报告列表内容。</p>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>打开对话框</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>确认操作</DialogTitle>
                          <DialogDescription>
                            此操作将影响当前选中的项目。
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <Input placeholder="输入名称" />
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="选择类型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="seo">SEO 审计</SelectItem>
                              <SelectItem value="geo">GEO 监测</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="secondary">取消</Button>
                          </DialogClose>
                          <Button onClick={() => setDialogOpen(false)}>确认</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </div>
            </DashboardSection>

            {/* 加载状态 */}
            <DashboardSection title="加载状态">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-2/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </DashboardSection>
          </div>
        </SonnerProvider>
      </ToastProvider>
    </TooltipProvider>
  )
}
