import type { drive_v3 } from "googleapis";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function escapeDriveQueryName(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Lista hijos carpeta con nombre exacto; devuelve el id o null. */
export async function findChildFolderByName(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string | null> {
  const q = `'${parentId}' in parents and mimeType='${FOLDER_MIME}' and name='${escapeDriveQueryName(
    name
  )}' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const id = res.data.files?.[0]?.id;
  return id || null;
}

export async function findOrCreateChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string> {
  const existing = await findChildFolderByName(drive, parentId, name);
  if (existing) return existing;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`No se pudo crear la carpeta "${name}"`);
  return created.data.id;
}

/** Resuelve carpeta destino: {root}/{sector}/{YYYY-MM}/ */
export async function resolveFacturaUploadFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  sectorFolderName: string,
  yearMonth: string
): Promise<string> {
  const sectorId = await findOrCreateChildFolder(drive, rootFolderId, sectorFolderName);
  return findOrCreateChildFolder(drive, sectorId, yearMonth);
}
