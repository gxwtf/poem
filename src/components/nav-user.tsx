"use client"

import {
  BadgeCheck,
  ChevronsUpDown,
  CreditCard, 
  User,
  LogIn,
  LogOut,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import useSession from "@/lib/use-session"
import { defaultSession } from "@/lib/iron"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link";
import { useRouter } from "next/navigation"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
    vip: boolean
  }
}) {
  const { isMobile } = useSidebar()
  const { logout } = useSession()
  const router = useRouter()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg"><User className="size-5" /></AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="flex items-center gap-1">
                  <span className="truncate font-medium">{user.name}</span>
                  {user.vip ? <Badge variant="default" className="text-xs font-italic bg-yellow-400 text-yellow-900 border-yellow-500">VIP</Badge> : null}
                </div>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg"><User className="size-5" /></AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-medium">{user.name}</span>
                    {user.vip ? <Badge variant="default" className="text-xs font-italic bg-yellow-400 text-yellow-900 border-yellow-500">VIP</Badge> : null}
                  </div>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            {user.avatar != "#" && (<>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="https://gxwtf.cn/account">
                    <BadgeCheck />
                    账号中心
                  </Link>
                </DropdownMenuItem>
                { user.vip ? <DropdownMenuItem asChild>
                  <Link href="https://gxwtf.cn/admin">
                    <CreditCard />
                    会员中心
                  </Link>
                </DropdownMenuItem> : null}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => {
                e.preventDefault()
                logout(null, {
                  optimisticData: defaultSession,
                })
              }}>
                <LogOut />
                登出
              </DropdownMenuItem>
            </>)}
            {user.avatar == "#" && (<>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => {
                e.preventDefault()
                if (typeof window !== 'undefined') {
                  router.push(`/login?back=${window.location.pathname}`)
                }
              }}>
                <LogIn />
                登录
              </DropdownMenuItem>
            </>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
