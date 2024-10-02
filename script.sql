

SELECT release_time, datetime(release_time, '+2 hours') AS GMT_Style  FROM news1
order by release_time DESC


SELECT release_time, *
 FROM news
order by release_time DESC

UPDATE news
SET release_time = datetime(release_time, '+2 hours')


DROP TABLE news

DELETE FROM news
WHERE id = 90

CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    headline TEXT,
    summary TEXT,
    release_time TEXT,
    link TEXT)

INSERT INTO news1 (headline,
    summary,
    release_time,
    link)
SELECT headline,
    summary,
    release_time,
    link
    FROM news