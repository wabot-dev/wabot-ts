import assert from 'node:assert/strict'
import test from 'node:test'

import { Entity, IEntityData } from '@/core/entity'
import { container } from '@/core/injection'
import { query, repository } from '@/feature/repository'

import { entityFixture, useMemoryRepositories } from './repositories'

interface INoteData extends IEntityData {
  title: string
  status?: string
}

class Note extends Entity<INoteData> {
  get title() {
    return this.data.title
  }
}

@repository({ table: 'note', constructor: Note })
class NoteRepository {
  declare find: (id: string) => Promise<Note | null>
  declare create: (item: Note) => Promise<void>
  declare findAll: () => Promise<Note[]>

  @query() declare findByStatus: (status: string) => Promise<Note[]>
}

useMemoryRepositories()

test('useMemoryRepositories backs @repository classes without PG or disk', async () => {
  const repo = container.resolve(NoteRepository)

  const note = new Note({ title: 'first', status: 'open' })
  await repo.create(note)

  const found = await repo.find(note.id)
  assert.equal(found?.title, 'first')

  const open = await repo.findByStatus('open')
  assert.equal(open.length, 1)
})

test('entityFixture builds an already-created, valid entity', () => {
  const note = entityFixture(Note, { title: 'seeded' }, { id: 'note-1' })

  assert.equal(note.id, 'note-1')
  assert.equal(note.title, 'seeded')
  assert.ok(note.wasCreated())
  assert.ok(note.createdAt instanceof Date)
})
