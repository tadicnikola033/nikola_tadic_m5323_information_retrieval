## Projekat iz predmeta "Pronalaženje informacija"
### Student: Nikola Tadić M53/2023
### Profesor: Dragan Urošević

### Detalji projekta na sledećem linku:
https://course.khoury.northeastern.edu/cs6200s14/pr1/pr1.html

#### Dodatne napomene:
- Korišćen je NodeJS i Typescript.
- Korišćen je skup tekstova sa nazivom "corpus".
- Da bi projekat radio, potrebno je skinuti taj skup tekstova sa linka: https://www.ccs.neu.edu/course/cs6200s14/ssl/data/corpus.tgz
 i raspakovati ga i smestiti u resources/corpus. Takođe je potrebno skinuti stoplist.txt sa linka: https://course.khoury.northeastern.edu/cs6200s14/pr1/stoplist.txt i smestiti u resources/stoplist.txt

### Pokretanje projekta:
1. npm i
2. npm build
3. npm run start (pokrece prvo tokenizer, pa potom kreira inverted index)
4. npm run read (omogucava analizu određenog dokumenta ili termina, potrebno je proslediti parametre)

### Primeri za parametre read skripte:
#### Get document info
npm run read -- --doc clueweb12-0000tw-13-04988

#### Get term info
npm run read -- --term asparagus

#### Get term occurrences in document
npm run read -- --term health --doc clueweb12-0000tw-13-04988
