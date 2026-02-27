// ---------------------------------------------------------------
// Teaching Materials API - /api/v1/teaching-materials
// Handles actual PDF/file uploads stored in /public/uploads/materials.
// Academic Operators upload; batch Teachers + Students can read.
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const AO_ROLES = ['academic_operator', 'owner', 'batch_coordinator'];
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'text/plain',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// -- GET -----------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.get('batch_id');

    // -- Teacher: materials for batches they are assigned to --
    if (user.role === 'teacher') {
      const result = await db.query(
        `SELECT tm.id, tm.batch_id, tm.subject, tm.title, tm.description,
                tm.file_url, tm.file_name, tm.file_size, tm.mime_type,
                tm.material_type, tm.uploaded_by, tm.created_at, b.batch_name
         FROM teaching_materials tm
         JOIN  batches b ON b.batch_id = tm.batch_id
         WHERE tm.batch_id IN (
           SELECT bt.batch_id FROM batch_teachers bt WHERE bt.teacher_email = $1
         )
         ${batchFilter ? 'AND tm.batch_id = $2' : ''}
         ORDER BY tm.created_at DESC`,
        batchFilter ? [user.id, batchFilter] : [user.id]
      );
      return NextResponse.json({ success: true, data: { materials: result.rows } });
    }

    // -- Student: materials for batches they are enrolled in --
    if (user.role === 'student') {
      const result = await db.query(
        `SELECT tm.id, tm.batch_id, tm.subject, tm.title, tm.description,
                tm.file_url, tm.file_name, tm.file_size, tm.mime_type,
                tm.material_type, tm.created_at, b.batch_name
         FROM teaching_materials tm
         JOIN  batches b ON b.batch_id = tm.batch_id
         WHERE tm.batch_id IN (
           SELECT bs.batch_id FROM batch_students bs WHERE bs.student_email = $1
         )
         ${batchFilter ? 'AND tm.batch_id = $2' : ''}
         ORDER BY tm.created_at DESC`,
        batchFilter ? [user.id, batchFilter] : [user.id]
      );
      return NextResponse.json({ success: true, data: { materials: result.rows } });
    }

    // -- Academic Operator / Owner / Coordinator --
    if (AO_ROLES.includes(user.role ?? '')) {
      const isOwner = user.role === 'owner';
      const params: string[] = isOwner ? [] : [user.id];

      let query = `
        SELECT tm.id, tm.batch_id, tm.subject, tm.title, tm.description,
               tm.file_url, tm.file_name, tm.file_size, tm.mime_type,
               tm.material_type, tm.uploaded_by, tm.created_at, b.batch_name
        FROM teaching_materials tm
        JOIN  batches b ON b.batch_id = tm.batch_id
        WHERE 1=1
      `;
      if (!isOwner) { query += ` AND tm.uploaded_by = $${params.length}`; }
      if (batchFilter) { params.push(batchFilter); query += ` AND tm.batch_id = $${params.length}`; }
      query += ' ORDER BY tm.created_at DESC';

      const [materialsResult, batchResult] = await Promise.all([
        db.query(query, params),
        isOwner
          ? db.query(`SELECT batch_id, batch_name, subjects, grade FROM batches WHERE status = 'active' ORDER BY batch_name`)
          : db.query(`SELECT batch_id, batch_name, subjects, grade FROM batches WHERE academic_operator_email = $1 AND status = 'active' ORDER BY batch_name`, [user.id]),
      ]);

      return NextResponse.json({ success: true, data: { materials: materialsResult.rows, batches: batchResult.rows } });
    }

    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  } catch (err) {
    console.error('[teaching-materials GET]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// -- POST (multipart file upload) -----------------------------
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !AO_ROLES.includes(user.role ?? '')) {
      return NextResponse.json({ success: false, error: 'Academic Operator access only' }, { status: 403 });
    }

    const formData      = await req.formData();
    const file          = formData.get('file') as File | null;
    const batch_id      = (formData.get('batch_id')      as string | null)?.trim();
    const subject       = (formData.get('subject')       as string | null)?.trim();
    const title         = (formData.get('title')         as string | null)?.trim();
    const description   = (formData.get('description')   as string | null)?.trim() || null;
    const material_type = (formData.get('material_type') as string | null) || 'notes';

    if (!batch_id) return NextResponse.json({ success: false, error: 'Batch is required' },   { status: 400 });
    if (!subject)  return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 });
    if (!title)    return NextResponse.json({ success: false, error: 'Title is required' },   { status: 400 });
    if (!file)     return NextResponse.json({ success: false, error: 'File is required' },    { status: 400 });

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'File type not allowed. Use PDF, Word, PowerPoint, Excel, images or plain text.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 50 MB)' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'materials');
    await mkdir(uploadDir, { recursive: true });

    const ext      = path.extname(file.name) || '';
    const safeName = `${randomUUID()}${ext}`;
    await writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()));

    const result = await db.query(
      `INSERT INTO teaching_materials
         (batch_id, subject, title, description, file_url, file_name, file_size, mime_type, material_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [batch_id, subject, title, description,
       `/uploads/materials/${safeName}`, file.name, file.size, file.type,
       material_type, user.id]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[teaching-materials POST]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// -- DELETE ---------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !AO_ROLES.includes(user.role ?? '')) {
      return NextResponse.json({ success: false, error: 'Academic Operator access only' }, { status: 403 });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Material ID required' }, { status: 400 });

    const isOwner = user.role === 'owner';
    const existing = await db.query(
      isOwner
        ? `SELECT id, file_url FROM teaching_materials WHERE id = $1`
        : `SELECT id, file_url FROM teaching_materials WHERE id = $1 AND uploaded_by = $2`,
      isOwner ? [id] : [id, user.id]
    );

    if (existing.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Material not found or not yours' }, { status: 404 });
    }

    const fileUrl = existing.rows[0].file_url as string;
    if (fileUrl?.startsWith('/uploads/materials/')) {
      try { await unlink(path.join(process.cwd(), 'public', fileUrl)); } catch { /* already gone */ }
    }

    await db.query(`DELETE FROM teaching_materials WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[teaching-materials DELETE]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}