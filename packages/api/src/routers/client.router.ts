import { z } from "zod";
import {
  archiveClient,
  attachProjectToClient,
  createClient,
  detachProjectFromClient,
  getClientById,
  getClientDeliveryLedger,
  listBasicClients,
  listClients,
  updateClient
} from "../services/client.service";
import { protectedProcedure, router } from "../trpc";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const contactEmailCreate = z
  .string()
  .trim()
  .email()
  .max(254)
  .optional()
  .or(z.literal("").transform(() => undefined));

const contactEmailUpdate = z
  .string()
  .trim()
  .email()
  .max(254)
  .nullish()
  .or(z.literal("").transform(() => null));

const clientStatusSchema = z.enum(["active", "archived"]);

export const clientRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(140),
        companyName: optionalText(160),
        contactName: optionalText(160),
        contactEmail: contactEmailCreate,
        notes: optionalText(4_000)
      })
    )
    .mutation(({ ctx, input }) => createClient(ctx, input)),

  list: protectedProcedure.query(({ ctx }) => listClients(ctx)),

  listBasic: protectedProcedure.query(({ ctx }) => listBasicClients(ctx)),

  getById: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getClientById(ctx, input.clientId)),

  update: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        name: z.string().trim().min(1).max(140).optional(),
        companyName: nullableText(160).optional(),
        contactName: nullableText(160).optional(),
        contactEmail: contactEmailUpdate.optional(),
        notes: nullableText(4_000).optional(),
        status: clientStatusSchema.optional()
      })
    )
    .mutation(({ ctx, input }) => updateClient(ctx, input)),

  archive: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) => archiveClient(ctx, input.clientId)),

  attachProject: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        projectId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) => attachProjectToClient(ctx, input)),

  detachProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) => detachProjectFromClient(ctx, input)),

  getDeliveryLedger: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getClientDeliveryLedger(ctx, input.clientId))
});
