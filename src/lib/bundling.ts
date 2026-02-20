import { prisma } from "@/lib/db";
import { generateEmbedding, cosineSimilarity, parseEmbedding } from "@/lib/embeddings";
import { TodoStatus, BundleStatus } from "@/types";

// Union-Find for clustering
class UnionFind {
  parent: Map<string, string> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string) {
    const px = this.find(x);
    const py = this.find(y);
    if (px !== py) this.parent.set(px, py);
  }
}

export async function runBundleAnalysis() {
  const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.82");

  // Get all open todos
  const todos = await prisma.todo.findMany({
    where: { status: { in: [TodoStatus.OPEN, TodoStatus.IN_PROGRESS] } },
  });

  if (todos.length < 2) {
    return { bundles: [], message: "Not enough open todos to analyze" };
  }

  // Generate embeddings for todos that don't have one
  for (const todo of todos) {
    if (!todo.embedding) {
      const text = `${todo.title} ${todo.description || ""}`.trim();
      const embedding = await generateEmbedding(text);
      if (embedding) {
        await prisma.todo.update({
          where: { id: todo.id },
          data: { embedding: JSON.stringify(embedding) },
        });
        todo.embedding = JSON.stringify(embedding);
      }
    }
  }

  // Calculate pairwise similarities
  const uf = new UnionFind();
  const similarities: Array<{ a: string; b: string; score: number }> = [];

  for (let i = 0; i < todos.length; i++) {
    const embA = parseEmbedding(todos[i].embedding);
    if (!embA) continue;

    for (let j = i + 1; j < todos.length; j++) {
      const embB = parseEmbedding(todos[j].embedding);
      if (!embB) continue;

      const score = cosineSimilarity(embA, embB);
      if (score >= threshold) {
        uf.union(todos[i].id, todos[j].id);
        similarities.push({ a: todos[i].id, b: todos[j].id, score });
      }
    }
  }

  // Group by clusters
  const clusters = new Map<string, Set<string>>();
  for (const todo of todos) {
    const root = uf.find(todo.id);
    if (!clusters.has(root)) clusters.set(root, new Set());
    clusters.get(root)!.add(todo.id);
  }

  // Create bundles for clusters with 2+ members
  const newBundles = [];
  for (const [, memberIds] of clusters) {
    if (memberIds.size < 2) continue;

    const ids = Array.from(memberIds);

    // Check if an existing SUGGESTED bundle already covers these todos
    const existingBundles = await prisma.bundle.findMany({
      where: {
        status: BundleStatus.SUGGESTED,
        members: { some: { todoId: { in: ids } } },
      },
    });
    if (existingBundles.length > 0) continue;

    // Calculate avg similarity for the cluster
    const clusterSims = similarities.filter(
      (s) => memberIds.has(s.a) && memberIds.has(s.b)
    );
    const avgScore =
      clusterSims.length > 0
        ? clusterSims.reduce((sum, s) => sum + s.score, 0) / clusterSims.length
        : threshold;

    // Generate label from todo titles
    const memberTodos = todos.filter((t: { id: string }) => memberIds.has(t.id));
    const autoLabel = memberTodos.map((t: { title: string }) => t.title).join(" / ");

    const bundle = await prisma.bundle.create({
      data: {
        status: BundleStatus.SUGGESTED,
        similarityScore: avgScore,
        autoLabel: autoLabel.slice(0, 200),
        members: {
          create: ids.map((todoId) => ({ todoId })),
        },
      },
      include: { members: { include: { todo: true } } },
    });

    newBundles.push(bundle);
  }

  return {
    bundles: newBundles,
    analyzed: todos.length,
    clustersFound: newBundles.length,
  };
}
