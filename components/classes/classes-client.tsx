"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Search, Users, BookOpen, ClipboardList,
  Loader2, Trash2, MoreVertical, GraduationCap,
  Settings, Archive, ArchiveRestore,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { fetchWithCache } from "@/lib/offline-cache";
import { toast } from "sonner";
import type { User, Class } from "@/types";

interface ClassesClientProps {
  user: User;
}

const BANNER_COLORS = [
  "from-blue-500 to-blue-700",
  "from-indigo-500 to-indigo-700",
  "from-purple-500 to-purple-700",
  "from-green-500 to-green-700",
  "from-teal-500 to-teal-700",
  "from-orange-500 to-orange-700",
  "from-pink-500 to-pink-700",
  "from-cyan-500 to-cyan-700",
];

const getBannerColor = (name: string) => BANNER_COLORS[name.charCodeAt(0) % BANNER_COLORS.length];

interface ClassWithStats extends Class {
  student_count?: number;
  material_count?: number;
  assignment_count?: number;
  is_archived?: boolean;
}

export function ClassesClient({ user }: ClassesClientProps) {
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newClass, setNewClass] = useState({ class_name: "", major: "", grade: "" });

  const fetchClasses = async () => {
    const supabase = createClient();
    let query = supabase.from("classes").select("*").order("grade").order("class_name");
    if (user.role === "student" && user.class_id) {
      query = supabase.from("classes").select("*").eq("id", user.class_id);
    }
    const { data: classData, error } = await query;
    if (error || !classData) { setLoading(false); return; }

    const classesWithStats = await Promise.all(
      classData.map(async (cls) => {
        const supabase2 = createClient();
        const [studentsRes, materialsRes, assignmentsRes] = await Promise.all([
          supabase2.from("users").select("id", { count: "exact" }).eq("class_id", cls.id).eq("role", "student"),
          supabase2.from("materials").select("id", { count: "exact" }).eq("class_id", cls.id),
          supabase2.from("assignments").select("id", { count: "exact" }).eq("class_id", cls.id),
        ]);
        return {
          ...cls,
          student_count: studentsRes.count || 0,
          material_count: materialsRes.count || 0,
          assignment_count: assignmentsRes.count || 0,
        };
      })
    );
    setClasses(classesWithStats);
    setLoading(false);
  };

  useEffect(() => { fetchClasses(); }, []);

  const handleCreateClass = async () => {
    if (!newClass.class_name || !newClass.major || !newClass.grade) {
      toast.error("All fields are required");
      return;
    }
    setCreating(true);
    const supabase = createClient();
    const { error } = await supabase.from("classes").insert([{ ...newClass, is_archived: false }]);
    if (error) {
      toast.error("Failed to create class: " + error.message);
    } else {
      toast.success("Class created!");
      setShowCreateDialog(false);
      setNewClass({ class_name: "", major: "", grade: "" });
      fetchClasses();
    }
    setCreating(false);
  };

  const handleArchiveClass = async (id: string, name: string, archive: boolean) => {
    const action = archive ? "archive" : "restore";
    if (!confirm(`${archive ? "Archive" : "Restore"} class "${name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("classes").update({ is_archived: archive }).eq("id", id);
    if (error) toast.error(`Failed to ${action} class`);
    else {
      toast.success(`Class ${archive ? "archived" : "restored"}!`);
      fetchClasses();
    }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (!confirm(`Permanently delete class "${name}"? All data will be lost.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) toast.error("Failed to delete class");
    else { toast.success("Class deleted"); fetchClasses(); }
  };

  const activeClasses = classes.filter(
    (c) => !c.is_archived &&
      (c.class_name.toLowerCase().includes(search.toLowerCase()) ||
       c.major.toLowerCase().includes(search.toLowerCase()))
  );
  const archivedClasses = classes.filter(
    (c) => c.is_archived &&
      (c.class_name.toLowerCase().includes(search.toLowerCase()) ||
       c.major.toLowerCase().includes(search.toLowerCase()))
  );

  const ClassCard = ({ cls, archived = false }: { cls: ClassWithStats; archived?: boolean }) => (
    <div className={`group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800 flex flex-col ${archived ? "opacity-70" : ""}`}>
      {/* Banner */}
      <Link href={archived ? "#" : `/classes/${cls.id}`} className={archived ? "pointer-events-none" : "block"}>
        <div className={`relative h-28 bg-gradient-to-br ${getBannerColor(cls.class_name)} p-4`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-6 -translate-x-6" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-white/20 text-white border-white/30 text-xs">Grade {cls.grade}</Badge>
              {archived && <Badge className="bg-gray-900/40 text-white border-white/20 text-xs gap-1"><Archive className="w-2.5 h-2.5" />Archived</Badge>}
            </div>
            <h3 className="text-white font-bold text-lg leading-tight">{cls.class_name}</h3>
            <p className="text-white/80 text-xs mt-0.5">{cls.major}</p>
          </div>
          <div className="absolute bottom-3 right-3 w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/40">
            <span className="text-white text-xs font-bold">AS</span>
          </div>
        </div>
      </Link>

      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{cls.student_count} students</span>
          <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{cls.material_count} materials</span>
          <span className="flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />{cls.assignment_count} tasks</span>
        </div>

        <div className="flex gap-2 mt-auto">
          {!archived ? (
            <Link href={`/classes/${cls.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full rounded-xl text-xs font-semibold hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-blue-950">
                Open Class
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl text-xs gap-1.5"
              onClick={() => handleArchiveClass(cls.id, cls.class_name, false)}
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
              Restore
            </Button>
          )}

          {user.role === "teacher" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                {!archived ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href={`/classes/${cls.id}`} className="gap-2">
                        <Settings className="w-4 h-4" />Manage Class
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/assignments/create?class=${cls.id}`} className="gap-2">
                        <ClipboardList className="w-4 h-4" />Create Assignment
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/materials/upload?class=${cls.id}`} className="gap-2">
                        <BookOpen className="w-4 h-4" />Upload Material
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-yellow-600 dark:text-yellow-400"
                      onClick={() => handleArchiveClass(cls.id, cls.class_name, true)}
                    >
                      <Archive className="w-4 h-4" />Archive Class
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => handleArchiveClass(cls.id, cls.class_name, false)}
                  >
                    <ArchiveRestore className="w-4 h-4" />Restore Class
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 dark:text-red-400 gap-2"
                  onClick={() => handleDeleteClass(cls.id, cls.class_name)}
                >
                  <Trash2 className="w-4 h-4" />Delete Permanently
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Classes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {user.role === "teacher"
              ? `${activeClasses.length} active · ${archivedClasses.length} archived · Academic Year 2025/2026`
              : "Classes you are enrolled in"}
          </p>
        </div>
        {user.role === "teacher" && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md rounded-xl"
          >
            <Plus className="w-4 h-4" />Create Class
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search classes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Tabs — Active / Archived (teacher only) */}
      {user.role === "teacher" ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active" className="gap-2">
              Active
              {activeClasses.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {activeClasses.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-2">
              <Archive className="w-3.5 h-3.5" />
              Archived
              {archivedClasses.length > 0 && (
                <span className="bg-gray-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {archivedClasses.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1,2,3,4].map((i) => <div key={i} className="h-56 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
              </div>
            ) : activeClasses.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No active classes</p>
                <Button onClick={() => setShowCreateDialog(true)} className="mt-4 gap-2 rounded-xl">
                  <Plus className="w-4 h-4" />Create Your First Class
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeClasses.map((cls) => <ClassCard key={cls.id} cls={cls} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1,2].map((i) => <div key={i} className="h-56 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
              </div>
            ) : archivedClasses.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Archive className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No archived classes</p>
                <p className="text-sm mt-1">Archive a class from the active tab to store it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {archivedClasses.map((cls) => <ClassCard key={cls.id} cls={cls} archived />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        /* Student view — no tabs */
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2].map((i) => <div key={i} className="h-56 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {classes.filter((c) => !c.is_archived).map((cls) => <ClassCard key={cls.id} cls={cls} />)}
          </div>
        )
      )}

      {/* Create Class Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class Name</Label>
              <Input placeholder="e.g. XI Butik 1" value={newClass.class_name}
                onChange={(e) => setNewClass({ ...newClass, class_name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Major / Department</Label>
              <Input placeholder="e.g. Fashion Design" value={newClass.major}
                onChange={(e) => setNewClass({ ...newClass, major: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Grade Level</Label>
              <Input placeholder="e.g. XI or XII" value={newClass.grade}
                onChange={(e) => setNewClass({ ...newClass, grade: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreateClass} disabled={creating} className="rounded-xl">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
