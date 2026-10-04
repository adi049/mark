-- MARKIPIE catalog seed
-- Idempotently loads the studio services and marketing offers into Supabase.

insert into public.services (title, slug, description, image, price, sort_order, active) values
('Wedding Photography','wedding-photography','Complete wedding day coverage by the Markipie photography team, from getting ready to the last dance.','https://images.pexels.com/photos/32107225/pexels-photo-32107225.jpeg?auto=compress&cs=tinysrgb&w=1600',null,1,true),
('Wedding Cinematography','wedding-cinematography','Wedding films shot and edited by the in-house cinematography crew, from highlight reels to full-length edits.','https://images.pexels.com/photos/30902343/pexels-photo-30902343.jpeg?auto=compress&cs=tinysrgb&w=1600',null,2,true),
('Candid Photography','candid-photography','Unposed, natural coverage across all your functions, led by the studio candid specialists.','https://images.pexels.com/photos/33318107/pexels-photo-33318107.jpeg?auto=compress&cs=tinysrgb&w=1600',null,3,true),
('Engagement Photography','engagement-photography','Engagement sessions with a relaxed, editorial approach, planned around you as a couple.','https://images.pexels.com/photos/37438502/pexels-photo-37438502.jpeg?auto=compress&cs=tinysrgb&w=1600',null,4,true),
('Haldi Coverage','haldi','Haldi mornings covered in their own bright, joyful mood, from the first turmeric touch to the family fun.','https://images.pexels.com/photos/31580448/pexels-photo-31580448.jpeg?auto=compress&cs=tinysrgb&w=1600',null,5,true),
('Mehendi Coverage','mehendi','Mehendi afternoons documented in detail: the patterns, the people and the music in between.','https://images.pexels.com/photos/14693637/pexels-photo-14693637.jpeg?auto=compress&cs=tinysrgb&w=1600',null,6,true),
('Reception Coverage','reception','Reception evenings covered as they happen: entrances, speeches, dinner and the dance floor.','https://images.pexels.com/photos/30902343/pexels-photo-30902343.jpeg?auto=compress&cs=tinysrgb&w=1600',null,7,true),
('Pre-Wedding','pre-wedding','Pre-wedding stories planned and shot as a couple session, at the studio or a location of your choice.','https://images.pexels.com/photos/34156349/pexels-photo-34156349.jpeg?auto=compress&cs=tinysrgb&w=1600',null,8,true),
('Drone Coverage','drone-coverage','Aerial coverage for venues, outdoor functions and cinematic establishing shots. Included in the packages that list it.','https://images.pexels.com/photos/37179307/pexels-photo-37179307.jpeg?auto=compress&cs=tinysrgb&w=1600',null,9,true),
('Album Design','album-design','Hand-finished printed albums, designed and produced by the studio. Album sheets and finishes follow your package.',null,null,10,true),
('Colour Lab and Printing','colour-lab-printing','Color grading and print production run on the in-house lab with twelve color printing machines.',null,null,11,true),
('Event Photography','event-photography','Coverage for family functions, receptions and celebrations of every scale.','https://images.pexels.com/photos/32325928/pexels-photo-32325928.jpeg?auto=compress&cs=tinysrgb&w=1600',null,12,true),
('Editing','video-editing','Video editing finished in the studio editing suite, from event footage to brand films.','https://images.pexels.com/photos/33318107/pexels-photo-33318107.jpeg?auto=compress&cs=tinysrgb&w=1600',null,13,true),
('Graphic Design','graphic-design','Design work for invitations, albums and brand assets, produced by the studio design desk.','https://images.pexels.com/photos/30416033/pexels-photo-30416033.jpeg?auto=compress&cs=tinysrgb&w=1600',null,14,true),
('Social Media Management','social-media-management','Planning, shooting and running social content for brands, handled end to end by the studio.','https://images.pexels.com/photos/7922177/pexels-photo-7922177.jpeg?auto=compress&cs=tinysrgb&w=1600',null,15,true)
on conflict (slug) do update set title=excluded.title, description=excluded.description, image=excluded.image, sort_order=excluded.sort_order, active=true, updated_at=now();

insert into public.marketing_services (title, description, starting_price, content, active, sort_order)
select * from (values
('Social Media Management','Planning, shooting and running social content for brands.','₹15,000','Starting per month. Includes video shoot and editing.',true,1),
('Video Editing','Your footage, cut and finished by the studio editing team.','₹1,500','Starting price.',true,2),
('Graphic Design','Design work for invitations, albums and brand assets.','₹700','Starting price.',true,3)
) as seed(title,description,starting_price,content,active,sort_order)
where not exists (select 1 from public.marketing_services m where m.title=seed.title);
