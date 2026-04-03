import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Target } from "lucide-react";
import { toast } from "sonner";

interface Goal { id: string; title: string; description: string | null; due_date: string; is_completed: boolean; }

const AdminGoalsCard = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    const { data } = await supabase.from("admin_goals").select("*").order("due_date");
    setGoals((data || []) as Goal[]);
  };

  const addGoal = async () => {
    if (!newTitle.trim() || !newDueDate) { toast.error("Título e data são obrigatórios"); return; }
    await supabase.from("admin_goals").insert({ title: newTitle, due_date: newDueDate });
    setNewTitle(""); setNewDueDate("");
    toast.success("Meta criada!"); fetchGoals();
  };

  const toggleGoal = async (goal: Goal) => {
    await supabase.from("admin_goals").update({
      is_completed: !goal.is_completed,
      completed_at: !goal.is_completed ? new Date().toISOString() : null,
    }).eq("id", goal.id);
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("admin_goals").delete().eq("id", id);
    toast.success("Meta removida"); fetchGoals();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Metas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Nova meta..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="w-40" />
          <Button size="sm" onClick={addGoal}><Plus className="h-4 w-4" /></Button>
        </div>
        {goals.map(goal => (
          <div key={goal.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
            <Checkbox checked={goal.is_completed} onCheckedChange={() => toggleGoal(goal)} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${goal.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{goal.title}</p>
              <p className="text-xs text-muted-foreground">Prazo: {new Date(goal.due_date).toLocaleDateString("pt-BR")}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => deleteGoal(goal.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        {goals.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Nenhuma meta definida</p>}
      </CardContent>
    </Card>
  );
};

export default AdminGoalsCard;
