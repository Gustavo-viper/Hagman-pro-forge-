-- 0016 — Personal reading shelf for the book library of each universe.
CREATE TABLE public.book_shelf (
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  entry_id   uuid NOT NULL REFERENCES public.lore_entries (id) ON DELETE CASCADE,
  status     text NOT NULL CHECK (status IN ('want', 'reading', 'read')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entry_id)
);
CREATE INDEX book_shelf_entry_idx ON public.book_shelf (entry_id, status);
