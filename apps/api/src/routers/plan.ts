import { sdk } from "../payload";
import { base, adminOnly } from "../rpc/base";
import { enrichPlanWithUserName } from "./router.helpers";

const list = base.plan.list.handler(async ({ input, context }) => {
  const where: Record<string, any> = {};

  // Under no circumstances should inactive plans be displayed to customers
  where.isActive = { not_equals: false };

  if (context.user?.id) {
    where.users = { contains: context.user.id };
  } else {
    return { items: [], total: 0 };
  }

  const result = await sdk.find({
    collection: "plans",
    where: Object.keys(where).length > 0 ? where : undefined,
    limit: input?.limit || 100,
    page: input?.page || 1,
    depth: 2,
    sort: "-createdAt",
  });

  const now = Date.now();
  const validDocs: any[] = [];
  for (const doc of result.docs) {
    // Under no circumstances should inactive plans be displayed
    if (doc.isActive === false) {
      continue;
    }

    const isExpired = Boolean(
      doc.expiresAt && new Date(doc.expiresAt).getTime() <= now,
    );
    const isUpcoming = Boolean(
      doc.startsAt && new Date(doc.startsAt).getTime() > now,
    );
    const status = isExpired ? "expired" : isUpcoming ? "upcoming" : "active";

    validDocs.push({
      ...doc,
      status,
      isExpired,
    });
  }

  const currentUserName = context.user?.fullName || "همکار";
  const items = validDocs.map((doc: any) => {
    const enriched = enrichPlanWithUserName(doc, currentUserName);
    const { users, ...safePlan } = enriched;
    return { ...safePlan, users: [context.user?.id] };
  });

  return {
    items,
    total: validDocs.length,
  };
});

const getById = base.plan.getById.handler(
  async ({ input, context, errors }) => {
    const doc: any = await sdk.findByID({
      collection: "plans",
      id: input.id,
      depth: 2,
    });

    if (!doc || doc.isActive === false) {
      throw errors.NOT_FOUND();
    }

    const now = Date.now();
    const isExpired = Boolean(
      doc.expiresAt && new Date(doc.expiresAt).getTime() <= now,
    );
    const isUpcoming = Boolean(
      doc.startsAt && new Date(doc.startsAt).getTime() > now,
    );
    const status = isExpired ? "expired" : isUpcoming ? "upcoming" : "active";

    if (!context.user?.id) {
      throw errors.NOT_FOUND();
    }
    const userIds = Array.isArray(doc.users)
      ? doc.users.map((u: any) =>
          typeof u === "object" && u !== null ? u.id : u,
        )
      : [];
    if (!userIds.map(String).includes(String(context.user.id))) {
      throw errors.NOT_FOUND();
    }

    const currentUserName = context.user?.fullName || "همکار";
    const enriched = enrichPlanWithUserName(doc, currentUserName);
    const { users, ...safePlan } = enriched;
    return {
      ...safePlan,
      status,
      isExpired,
      users: [context.user?.id],
    };
  },
);

const create = adminOnly.plan.create.handler(async ({ input }) => {
  let title = input.title;
  if (!title || title.trim() === "") {
    let name = "همکار";
    if (input.users && input.users.length > 0) {
      try {
        const user: any = await sdk.findByID({
          collection: "users",
          id: input.users[0],
        });
        if (user?.fullName) {
          name = user.fullName;
        }
      } catch {
        // ignore
      }
    }
    title = `${name} عزیز، این طرح برای شماست`;
  }

  return sdk.create({
    collection: "plans",
    data: {
      title,
      users: input.users.map((u: any) => Number(u)),
      content: input.content,
      startsAt: input.startsAt || null,
      expiresAt: input.expiresAt || null,
      isActive: input.isActive ?? true,
      products: input.products ? input.products.map((p: any) => Number(p)) : [],
    } as any,
    depth: 2,
  });
});

const update = adminOnly.plan.update.handler(async ({ input }) => {
  const { id, ...data } = input;

  return sdk.update({
    collection: "plans",
    id,
    data: data as any,
    depth: 2,
  });
});

export const plan = base.plan.router({
  list,
  getById,
  create,
  update,
});
